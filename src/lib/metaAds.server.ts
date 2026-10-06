import "server-only";

import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import {
  adRange,
  normalizeAdRules,
  type AdAccount,
  type AdCreative,
  type AdMedia,
  type AdRange,
  type AdRules,
} from "@/lib/metaAds";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION?.trim() || "v23.0";
const MAX_INSIGHT_ROWS = 1000;
const CACHE_MS = 5 * 60 * 1000;

type Action = { action_type: string; value: string };
type InsightRow = {
  ad_id: string;
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  inline_link_clicks?: string;
  actions?: Action[];
  action_values?: Action[];
  video_thruplay_watched_actions?: Action[];
};
type AdNode = {
  id: string;
  name?: string;
  effective_status?: string;
  created_time?: string;
  adset?: { name?: string };
  campaign?: { name?: string };
  creative?: {
    title?: string;
    body?: string;
    thumbnail_url?: string;
    image_url?: string;
    image_hash?: string;
    video_id?: string;
    object_type?: string;
    object_story_spec?: {
      link_data?: {
        image_hash?: string;
        picture?: string;
        message?: string;
        name?: string;
        child_attachments?: { image_hash?: string; picture?: string; video_id?: string }[];
      };
      video_data?: { video_id?: string; image_hash?: string; image_url?: string; message?: string; title?: string };
      photo_data?: { image_hash?: string; url?: string; caption?: string };
    };
    asset_feed_spec?: {
      images?: { hash?: string; url?: string }[];
      videos?: { video_id?: string; thumbnail_hash?: string; thumbnail_url?: string }[];
      bodies?: { text?: string }[];
      titles?: { text?: string }[];
    };
  };
};
/** One piece of media before its full-resolution URL is looked up. */
type MediaRef = { hash?: string; videoId?: string; fallback?: string };
type ImageInfo = { url: string; width: number | null; height: number | null };
type VideoInfo = { image: ImageInfo | null; source: string | null };
type Paged<T> = { data?: T[]; paging?: { next?: string } };

export class MetaAdsError extends Error {}

export function metaAdsConfig() {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  const account = process.env.META_AD_ACCOUNT_ID?.trim().replace(/^act_/, "");
  return token && account ? { token, accountId: `act_${account}` } : null;
}

async function graph<T>(pathOrUrl: string, params: Record<string, string>, token: string): Promise<T> {
  const url = pathOrUrl.startsWith("https://")
    ? new URL(pathOrUrl)
    : new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${pathOrUrl}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  if (!url.searchParams.has("access_token")) url.searchParams.set("access_token", token);

  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json().catch(() => null)) as (T & { error?: { message?: string; code?: number } }) | null;
  if (!res.ok || !data || data.error) {
    const message = data?.error?.message || `Meta API error (${res.status}).`;
    if (data?.error?.code === 190) throw new MetaAdsError("The Meta access token is invalid or expired. Generate a new one.");
    throw new MetaAdsError(message);
  }
  return data;
}

async function graphAll<T>(path: string, params: Record<string, string>, token: string, cap: number): Promise<T[]> {
  const rows: T[] = [];
  let page = await graph<Paged<T>>(path, params, token);
  rows.push(...(page.data ?? []));
  while (page.paging?.next && rows.length < cap) {
    page = await graph<Paged<T>>(page.paging.next, {}, token);
    rows.push(...(page.data ?? []));
  }
  return rows.slice(0, cap);
}

/** Meta reports the same event under several names; the first match wins so nothing is counted twice. */
function pick(actions: Action[] | undefined, types: string[]): number {
  if (!actions) return 0;
  for (const type of types) {
    const hit = actions.find((action) => action.action_type === type);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
}

const PURCHASE = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];
const ADD_TO_CART = ["omni_add_to_cart", "add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"];
const CHECKOUT = ["omni_initiated_checkout", "initiate_checkout", "offsite_conversion.fb_pixel_initiate_checkout"];

const AD_FIELDS =
  "name,effective_status,created_time,adset{name},campaign{name}," +
  "creative.thumbnail_width(1080).thumbnail_height(1080){title,body,thumbnail_url,image_url,image_hash,video_id,object_type,object_story_spec,asset_feed_spec}";
const MAX_MEDIA_PER_AD = 10;

/** Every image / video the creative shows, in the order people see them. */
function mediaRefs(node: AdNode | undefined): MediaRef[] {
  const creative = node?.creative;
  if (!creative) return [];
  const story = creative.object_story_spec;
  const feed = creative.asset_feed_spec;
  const refs: MediaRef[] = [];

  if (story?.video_data) {
    refs.push({ videoId: story.video_data.video_id, hash: story.video_data.image_hash, fallback: story.video_data.image_url });
  }
  if (story?.photo_data) refs.push({ hash: story.photo_data.image_hash, fallback: story.photo_data.url });
  if (story?.link_data?.child_attachments?.length) {
    for (const card of story.link_data.child_attachments) {
      refs.push({ hash: card.image_hash, videoId: card.video_id, fallback: card.picture });
    }
  } else if (story?.link_data) {
    refs.push({ hash: story.link_data.image_hash, fallback: story.link_data.picture });
  }
  for (const video of feed?.videos ?? []) refs.push({ videoId: video.video_id, hash: video.thumbnail_hash, fallback: video.thumbnail_url });
  for (const image of feed?.images ?? []) refs.push({ hash: image.hash, fallback: image.url });

  const usable = refs.filter((ref) => ref.hash || ref.videoId || ref.fallback);
  if (usable.length === 0) {
    usable.push({ hash: creative.image_hash, videoId: creative.video_id, fallback: creative.image_url || creative.thumbnail_url });
  }
  return usable.slice(0, MAX_MEDIA_PER_AD);
}

/** Original uploads from the account's image library, keyed by hash. */
async function fetchImages(accountId: string, hashes: string[], token: string): Promise<Map<string, ImageInfo>> {
  const images = new Map<string, ImageInfo>();
  for (let i = 0; i < hashes.length; i += 50) {
    try {
      const page = await graph<Paged<{ hash: string; url?: string; width?: number; height?: number }>>(
        `${accountId}/adimages`,
        { hashes: JSON.stringify(hashes.slice(i, i + 50)), fields: "hash,url,width,height", limit: "50" },
        token,
      );
      for (const image of page.data ?? []) {
        if (image.url) images.set(image.hash, { url: image.url, width: image.width ?? null, height: image.height ?? null });
      }
    } catch (err) {
      console.warn("[meta-ads] ad images lookup failed:", err instanceof Error ? err.message : err);
    }
  }
  return images;
}

type VideoNode = {
  id: string;
  source?: string;
  picture?: string;
  thumbnails?: { data?: { uri: string; width?: number; height?: number; is_preferred?: boolean }[] };
};

function videoInfo(node: VideoNode): VideoInfo {
  const thumbs = node.thumbnails?.data ?? [];
  const largest = [...thumbs].sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))[0];
  const preferred = thumbs.find((thumb) => thumb.is_preferred);
  const best = preferred && (preferred.width ?? 0) >= (largest?.width ?? 0) * 0.75 ? preferred : largest;
  return {
    image: best ? { url: best.uri, width: best.width ?? null, height: best.height ?? null } : node.picture ? { url: node.picture, width: null, height: null } : null,
    source: node.source ?? null,
  };
}

/**
 * Cover frames and playable files. `source` needs access to the page that owns the video,
 * so a failed batch is retried without it, then one video at a time.
 */
async function fetchVideos(ids: string[], token: string): Promise<Map<string, VideoInfo>> {
  const videos = new Map<string, VideoInfo>();
  const withSource = "source,picture,thumbnails{uri,width,height,is_preferred}";
  const withoutSource = "picture,thumbnails{uri,width,height,is_preferred}";
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const attempt = (fields: string) => graph<Record<string, VideoNode>>("", { ids: batch.join(","), fields }, token);
    const result = await attempt(withSource).catch(() => attempt(withoutSource)).catch(() => null);
    if (result) {
      for (const node of Object.values(result)) videos.set(node.id, videoInfo(node));
      continue;
    }
    const singles = await Promise.allSettled(batch.map((id) => graph<VideoNode>(id, { fields: withoutSource }, token)));
    for (const single of singles) {
      if (single.status === "fulfilled") videos.set(single.value.id, videoInfo(single.value));
    }
  }
  return videos;
}

function resolveMedia(
  node: AdNode | undefined,
  images: Map<string, ImageInfo>,
  videos: Map<string, VideoInfo>,
): AdMedia[] {
  const fallbackThumb = node?.creative?.thumbnail_url;
  const media: AdMedia[] = [];
  for (const ref of mediaRefs(node)) {
    const video = ref.videoId ? videos.get(ref.videoId) : undefined;
    const image = (ref.hash && images.get(ref.hash)) || video?.image || (ref.fallback ? { url: ref.fallback, width: null, height: null } : null);
    const url = image?.url || (media.length === 0 ? fallbackThumb : undefined);
    if (!url) continue;
    media.push({
      image: url,
      width: image?.width ?? null,
      height: image?.height ?? null,
      isVideo: Boolean(ref.videoId),
      videoUrl: video?.source ?? null,
    });
  }
  return media;
}

function adCopy(node: AdNode | undefined) {
  const creative = node?.creative;
  const story = creative?.object_story_spec;
  const feed = creative?.asset_feed_spec;
  return {
    title: creative?.title || story?.link_data?.name || story?.video_data?.title || feed?.titles?.[0]?.text || "",
    body:
      creative?.body ||
      story?.link_data?.message ||
      story?.video_data?.message ||
      story?.photo_data?.caption ||
      feed?.bodies?.[0]?.text ||
      "",
  };
}

function toCreative(node: AdNode | undefined, row: InsightRow | undefined, id: string, media: AdMedia[]): AdCreative {
  const creative = node?.creative;
  const num = (value: string | undefined) => Number(value) || 0;
  return {
    id,
    name: node?.name || row?.ad_name || id,
    status: node?.effective_status || "UNKNOWN",
    campaign: node?.campaign?.name || row?.campaign_name || "",
    adset: node?.adset?.name || row?.adset_name || "",
    createdAt: node?.created_time ?? null,
    media,
    isVideo: media[0]?.isVideo || Boolean(creative?.video_id) || creative?.object_type === "VIDEO",
    ...adCopy(node),
    spend: num(row?.spend),
    impressions: num(row?.impressions),
    reach: num(row?.reach),
    frequency: num(row?.frequency),
    linkClicks: num(row?.inline_link_clicks),
    addToCart: pick(row?.actions, ADD_TO_CART),
    checkouts: pick(row?.actions, CHECKOUT),
    purchases: pick(row?.actions, PURCHASE),
    revenue: pick(row?.action_values, PURCHASE),
    videoViews3s: pick(row?.actions, ["video_view"]),
    thruplays: pick(row?.video_thruplay_watched_actions, ["video_view"]),
  };
}

export type MetaAdsReport = { account: AdAccount; ads: AdCreative[]; fetchedAt: string };

const cache = new Map<AdRange, { at: number; report: MetaAdsReport }>();

/** Every ad that delivered in the range, plus active ads that have not delivered yet. */
export async function getMetaAdsReport(rangeKey: AdRange, fresh = false): Promise<MetaAdsReport> {
  const config = metaAdsConfig();
  if (!config) throw new MetaAdsError("Meta ads are not connected.");
  const cached = cache.get(rangeKey);
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.report;

  const { token, accountId } = config;
  const range = adRange(rangeKey);

  const [account, insights, active] = await Promise.all([
    graph<{ id: string; name?: string; currency?: string }>(accountId, { fields: "name,currency" }, token),
    graphAll<InsightRow>(
      `${accountId}/insights`,
      {
        level: "ad",
        date_preset: range.preset,
        fields:
          "ad_id,ad_name,adset_name,campaign_name,spend,impressions,reach,frequency,inline_link_clicks,actions,action_values,video_thruplay_watched_actions",
        limit: "500",
      },
      token,
      MAX_INSIGHT_ROWS,
    ),
    graphAll<AdNode>(
      `${accountId}/ads`,
      { fields: AD_FIELDS, effective_status: JSON.stringify(["ACTIVE"]), limit: "200" },
      token,
      500,
    ),
  ]);

  const nodes = new Map(active.map((node) => [node.id, node]));
  const missing = insights.map((row) => row.ad_id).filter((id) => !nodes.has(id));
  for (let i = 0; i < missing.length; i += 50) {
    const batch = await graph<Record<string, AdNode>>("", { ids: missing.slice(i, i + 50).join(","), fields: AD_FIELDS }, token);
    for (const node of Object.values(batch)) nodes.set(node.id, node);
  }

  const rows = new Map(insights.map((row) => [row.ad_id, row]));
  const ids = new Set([...rows.keys(), ...active.map((node) => node.id)]);
  const refs = [...ids].flatMap((id) => mediaRefs(nodes.get(id)));
  const hashes = [...new Set(refs.map((ref) => ref.hash).filter((hash): hash is string => Boolean(hash)))];
  const videoIds = [...new Set(refs.map((ref) => ref.videoId).filter((videoId): videoId is string => Boolean(videoId)))];
  const [images, videos] = await Promise.all([fetchImages(accountId, hashes, token), fetchVideos(videoIds, token)]);

  const ads = [...ids].map((id) => {
    const node = nodes.get(id);
    return toCreative(node, rows.get(id), id, resolveMedia(node, images, videos));
  });

  const report: MetaAdsReport = {
    account: { id: accountId, name: account.name || accountId, currency: account.currency || "EUR" },
    ads,
    fetchedAt: new Date().toISOString(),
  };
  cache.set(rangeKey, { at: Date.now(), report });
  return report;
}

let tableReady = false;

async function ensureRulesTable() {
  if (tableReady) return;
  await neonQuery(`
    CREATE TABLE IF NOT EXISTS meta_ads_rules (
      id int PRIMARY KEY DEFAULT 1,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  tableReady = true;
}

export async function getAdRules(): Promise<AdRules> {
  if (!resolveDatabaseUrl()) return normalizeAdRules(null);
  await ensureRulesTable();
  const { rows } = await neonQuery<{ data: unknown }>("SELECT data FROM meta_ads_rules WHERE id = 1");
  return normalizeAdRules(rows[0]?.data);
}

export async function saveAdRules(raw: unknown): Promise<AdRules> {
  const rules = normalizeAdRules(raw);
  await ensureRulesTable();
  await neonQuery(
    `INSERT INTO meta_ads_rules (id, data, updated_at) VALUES (1, $1::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
    [JSON.stringify(rules)],
  );
  return rules;
}
