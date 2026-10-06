"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleX,
  ExternalLink,
  Hourglass,
  ImageOff,
  Info,
  Layers,
  Lightbulb,
  Maximize2,
  Megaphone,
  Play,
  Plug,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  ThumbsUp,
  TriangleAlert,
  Trophy,
  Wrench,
  X,
} from "lucide-react";
import { AdRecommendations } from "@/components/AdRecommendations";
import { sizeGhostButton, sizeInputClass, sizeLabelClass } from "@/components/SizeChartEditor";
import {
  benchmarks,
  buildRecommendations,
  creativeTips,
  type JudgedAd,
  type Recommendation,
  type Tip,
} from "@/lib/adRecommendations";
import {
  AD_RANGES,
  adMetrics,
  adRange,
  adsManagerUrl,
  DEFAULT_AD_RULES,
  judgeCreative,
  moneyFormatter,
  resolveGoal,
  testBudget,
  VERDICT_ORDER,
  type AdAccount,
  type AdCreative,
  type AdGoal,
  type AdRange,
  type AdRules,
  type Verdict,
} from "@/lib/metaAds";

type Report = {
  connected: boolean;
  rules: AdRules;
  account?: AdAccount;
  ads?: AdCreative[];
  fetchedAt?: string;
  error?: string;
};

type Row = JudgedAd;

const TIP_STYLE: Record<Tip["tone"], { icon: typeof Trophy; className: string }> = {
  fix: { icon: Wrench, className: "bg-violet-100 text-violet-700" },
  watch: { icon: TriangleAlert, className: "bg-amber-100 text-amber-700" },
  good: { icon: ThumbsUp, className: "bg-emerald-100 text-emerald-700" },
};

type SortKey = "best" | "spend" | "roas" | "ctr" | "newest";

const VERDICT_STYLE: Record<Verdict, { label: string; badge: string; tab: string; bar: string; icon: typeof Trophy }> = {
  winner: {
    label: "Winning",
    badge: "bg-emerald-600 text-white",
    tab: "border-emerald-600 bg-emerald-50 text-emerald-800",
    bar: "bg-emerald-500",
    icon: Trophy,
  },
  promising: {
    label: "Promising",
    badge: "bg-sky-600 text-white",
    tab: "border-sky-600 bg-sky-50 text-sky-800",
    bar: "bg-sky-500",
    icon: Sparkles,
  },
  testing: {
    label: "Testing",
    badge: "bg-amber-400 text-black",
    tab: "border-amber-500 bg-amber-50 text-amber-800",
    bar: "bg-amber-400",
    icon: Hourglass,
  },
  loser: {
    label: "Not working",
    badge: "bg-red-600 text-white",
    tab: "border-red-600 bg-red-50 text-red-800",
    bar: "bg-red-500",
    icon: CircleX,
  },
};

const FLAG_STYLE = {
  good: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  bad: "bg-red-50 text-red-700",
} as const;

const pct = (value: number) => `${value.toFixed(2)}%`;
const count = (value: number) => Math.round(value).toLocaleString("fr-FR");

async function fetchReport(range: AdRange, fresh: boolean): Promise<Report> {
  const params = new URLSearchParams({ range });
  if (fresh) params.set("fresh", "1");
  const res = await fetch(`/api/backoffice/meta-ads?${params}`, { cache: "no-store" });
  const data = (await res.json().catch(() => null)) as Report | null;
  if (!data?.rules) throw new Error(data?.error || "Could not load your ads.");
  return data;
}

function sampleReport(): Report {
  const day = 86400000;
  const now = Date.now();
  const base = {
    status: "ACTIVE",
    campaign: "Sales — Broad FR",
    title: "",
    body: "",
    media: [],
    reach: 0,
    addToCart: 0,
    checkouts: 0,
    videoViews3s: 0,
    thruplays: 0,
  };
  const ad = (partial: Partial<AdCreative> & Pick<AdCreative, "id" | "name" | "spend" | "impressions">): AdCreative => {
    const merged = { ...base, adset: "Testing — 1 creative / ad set", createdAt: null, isVideo: false, frequency: 1.4, linkClicks: 0, purchases: 0, revenue: 0, ...partial };
    return { ...merged, reach: Math.round(merged.impressions / merged.frequency) };
  };
  return {
    connected: true,
    rules: DEFAULT_AD_RULES,
    account: { id: "act_000000", name: "Sample account", currency: "EUR" },
    fetchedAt: new Date().toISOString(),
    ads: [
      ad({ id: "s1", name: "UGC try-on — hoodie black", isVideo: true, spend: 182, impressions: 21400, linkClicks: 412, addToCart: 31, checkouts: 14, purchases: 9, revenue: 612, videoViews3s: 7900, thruplays: 1900, createdAt: new Date(now - 9 * day).toISOString(), body: "The hoodie everyone asks about. Heavyweight cotton, cut to sit right." }),
      ad({ id: "s2", name: "Flat lay — summer tee pack", spend: 96, impressions: 13200, linkClicks: 198, addToCart: 12, checkouts: 6, purchases: 3, revenue: 186, createdAt: new Date(now - 6 * day).toISOString() }),
      ad({ id: "s3", name: "Street shoot — cargo pants", isVideo: true, spend: 71, impressions: 9100, linkClicks: 121, addToCart: 6, checkouts: 3, purchases: 2, revenue: 158, videoViews3s: 3100, thruplays: 610, createdAt: new Date(now - 4 * day).toISOString() }),
      ad({ id: "s4", name: "Founder story — 30s", isVideo: true, spend: 22, impressions: 2600, linkClicks: 38, addToCart: 2, videoViews3s: 690, thruplays: 120, createdAt: new Date(now - 1 * day).toISOString() }),
      ad({ id: "s5", name: "Carousel — new drop", spend: 14, impressions: 1900, linkClicks: 24, addToCart: 1, createdAt: new Date(now - 1 * day).toISOString() }),
      ad({ id: "s6", name: "Static — 20% off banner", spend: 64, impressions: 11800, linkClicks: 41, addToCart: 1, createdAt: new Date(now - 7 * day).toISOString() }),
      ad({ id: "s7", name: "Model lookbook — jacket", isVideo: true, spend: 88, impressions: 10400, linkClicks: 133, addToCart: 7, checkouts: 2, purchases: 1, revenue: 79, frequency: 3.9, videoViews3s: 1500, thruplays: 210, createdAt: new Date(now - 12 * day).toISOString() }),
      ad({ id: "s8", name: "Review screenshot — tee", status: "PAUSED", spend: 120, impressions: 15600, linkClicks: 180, addToCart: 9, checkouts: 5, purchases: 4, revenue: 132, createdAt: new Date(now - 14 * day).toISOString() }),
    ],
  };
}

export default function DashboardAdsPage() {
  const [range, setRange] = useState<AdRange>("today");
  const [report, setReport] = useState<Report | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rules, setRules] = useState<AdRules>(DEFAULT_AD_RULES);
  const [savedRules, setSavedRules] = useState<AdRules>(DEFAULT_AD_RULES);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesSaved, setRulesSaved] = useState(false);

  const [filter, setFilter] = useState<Verdict | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("best");
  const [activeOnly, setActiveOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const applyReport = useCallback((data: Report) => {
    setReport(data);
    setRules(data.rules);
    setSavedRules(data.rules);
    setError(data.error ?? null);
  }, []);
  const failLoad = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : "Could not load your ads.");
  }, []);

  useEffect(() => {
    if (demo) return;
    fetchReport(range, false)
      .then(applyReport, failLoad)
      .finally(() => setLoading(false));
  }, [range, demo, applyReport, failLoad]);

  const changeRange = (next: AdRange) => {
    if (next === range) return;
    if (!demo) setLoading(true);
    setRange(next);
  };

  const refresh = async () => {
    if (demo) return;
    setRefreshing(true);
    await fetchReport(range, true).then(applyReport, failLoad);
    setRefreshing(false);
  };

  const sample = useMemo(() => (demo ? sampleReport() : null), [demo]);
  const shown = sample ?? report;
  const account = shown?.account;
  const ads = useMemo(() => shown?.ads ?? [], [shown?.ads]);
  const money = useMemo(() => moneyFormatter(account?.currency ?? "EUR"), [account?.currency]);
  const goal = resolveGoal(rules, ads);
  const rangeDays = adRange(range).days;

  const rows: Row[] = useMemo(
    () => ads.map((ad) => ({ ad, m: adMetrics(ad), j: judgeCreative(ad, rules, goal, money, rangeDays) })),
    [ads, rules, goal, money, rangeDays],
  );

  const counts = useMemo(() => {
    const result: Record<Verdict, number> = { winner: 0, promising: 0, testing: 0, loser: 0 };
    for (const row of rows) if (!activeOnly || row.ad.status === "ACTIVE") result[row.j.verdict] += 1;
    return result;
  }, [rows, activeOnly]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = rows.filter(
      (row) =>
        (filter === "all" || row.j.verdict === filter) &&
        (!activeOnly || row.ad.status === "ACTIVE") &&
        (!needle || `${row.ad.name} ${row.ad.campaign} ${row.ad.adset}`.toLowerCase().includes(needle)),
    );
    const by: Record<SortKey, (a: Row, b: Row) => number> = {
      best: (a, b) => VERDICT_ORDER.indexOf(a.j.verdict) - VERDICT_ORDER.indexOf(b.j.verdict) || b.j.score - a.j.score,
      spend: (a, b) => b.ad.spend - a.ad.spend,
      roas: (a, b) => (b.m.roas ?? -1) - (a.m.roas ?? -1),
      ctr: (a, b) => b.m.ctr - a.m.ctr,
      newest: (a, b) => (b.ad.createdAt ?? "").localeCompare(a.ad.createdAt ?? ""),
    };
    return [...list].sort(by[sort]);
  }, [rows, filter, query, sort, activeOnly]);

  const totals = useMemo(() => {
    const t = { spend: 0, purchases: 0, revenue: 0, impressions: 0, clicks: 0 };
    for (const { ad } of rows) {
      t.spend += ad.spend;
      t.purchases += ad.purchases;
      t.revenue += ad.revenue;
      t.impressions += ad.impressions;
      t.clicks += ad.linkClicks;
    }
    return t;
  }, [rows]);

  const bench = useMemo(() => benchmarks(rows), [rows]);
  const recs = useMemo(() => buildRecommendations(rows, rules, goal, money, rangeDays), [rows, rules, goal, money, rangeDays]);
  const selected = rows.find((row) => row.ad.id === selectedId) ?? null;
  const rulesDirty = JSON.stringify(rules) !== JSON.stringify(savedRules);

  const saveRules = async () => {
    if (demo) {
      setSavedRules(rules);
      return;
    }
    setSavingRules(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/meta-ads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const data = (await res.json().catch(() => null)) as { rules?: AdRules; error?: string } | null;
      if (!res.ok || !data?.rules) throw new Error(data?.error || "Could not save the rules.");
      setRules(data.rules);
      setSavedRules(data.rules);
      setRulesSaved(true);
      window.setTimeout(() => setRulesSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the rules.");
    } finally {
      setSavingRules(false);
    }
  };

  const notConnected = !loading && !demo && report && !report.connected;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-black sm:text-3xl">
            <Megaphone className="h-6 w-6 sm:h-7 sm:w-7" />
            Ad creatives
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Every Facebook &amp; Instagram creative, judged against your own numbers: scale the winners, cut the
            losers, and leave the rest alone until they have spent enough to be judged.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Date range" className="flex max-w-full overflow-x-auto rounded border border-zinc-300 bg-white p-0.5">
            {AD_RANGES.map((entry) => (
              <button
                key={entry.key}
                type="button"
                role="radio"
                aria-checked={range === entry.key}
                onClick={() => changeRange(entry.key)}
                className={`shrink-0 whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  range === entry.key ? "bg-black text-white" : "text-zinc-600 hover:text-black"
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setRulesOpen(true)} className={`${sizeGhostButton} py-2`}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Rules
            {rulesDirty ? <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Unsaved changes" /> : null}
          </button>
          {!demo ? (
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing || loading || !report?.connected}
              className="inline-flex items-center gap-1.5 rounded bg-black px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          ) : (
            <button type="button" onClick={() => setDemo(false)} className={`${sizeGhostButton} py-2`}>
              <X className="h-3.5 w-3.5" />
              Exit preview
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="text-red-400 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {demo ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Info className="h-4 w-4 shrink-0" />
          Sample data, so you can try the page. Open Rules to see how the verdicts change.
        </div>
      ) : null}

      {loading && !demo ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-zinc-100" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-80 animate-pulse rounded-lg bg-zinc-100" />
            ))}
          </div>
        </div>
      ) : notConnected ? (
        <ConnectCard onPreview={() => setDemo(true)} />
      ) : shown?.connected && account ? (
        <>
          <GoalNote goal={goal} rules={rules} money={money} singleDay={rangeDays === 1} />

          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Spend" value={money(totals.spend)} />
            {goal === "purchases" ? (
              <>
                <Kpi label="Sales" value={count(totals.purchases)} sub={totals.revenue > 0 ? money(totals.revenue) : undefined} />
                <Kpi
                  label="ROAS"
                  value={totals.spend > 0 && totals.revenue > 0 ? `${(totals.revenue / totals.spend).toFixed(2)}×` : "—"}
                  tone={totals.spend > 0 && totals.revenue / totals.spend >= rules.breakEvenRoas ? "good" : "bad"}
                  sub={`Break-even ${rules.breakEvenRoas}×`}
                />
                <Kpi
                  label="Cost per sale"
                  value={totals.purchases > 0 ? money(totals.spend / totals.purchases) : "—"}
                  tone={totals.purchases > 0 && totals.spend / totals.purchases <= rules.targetCpa ? "good" : "bad"}
                  sub={`Target ${money(rules.targetCpa)}`}
                />
              </>
            ) : (
              <>
                <Kpi label="Link clicks" value={count(totals.clicks)} sub={`${count(totals.impressions)} impressions`} />
                <Kpi
                  label="CTR"
                  value={totals.impressions > 0 ? pct((totals.clicks / totals.impressions) * 100) : "—"}
                  tone={totals.impressions > 0 && (totals.clicks / totals.impressions) * 100 >= rules.targetCtr ? "good" : "bad"}
                  sub={`Target ${rules.targetCtr}%`}
                />
                <Kpi
                  label="Cost per click"
                  value={totals.clicks > 0 ? money(totals.spend / totals.clicks) : "—"}
                  tone={totals.clicks > 0 && totals.spend / totals.clicks <= rules.targetCpc ? "good" : "bad"}
                  sub={`Target ${money(rules.targetCpc)}`}
                />
              </>
            )}
          </div>

          <AdRecommendations
            key={demo ? "demo" : account.id}
            rows={rows}
            recs={recs}
            money={money}
            accountId={account.id}
            demo={demo}
            onOpenAd={setSelectedId}
          />

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
                filter === "all" ? "border-black bg-black text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
              }`}
            >
              <span className="block text-[11px] font-semibold uppercase tracking-wider opacity-70">All</span>
              <span className="text-2xl font-bold">{Object.values(counts).reduce((a, b) => a + b, 0)}</span>
            </button>
            {VERDICT_ORDER.map((verdict) => {
              const style = VERDICT_STYLE[verdict];
              const Icon = style.icon;
              const active = filter === verdict;
              return (
                <button
                  key={verdict}
                  type="button"
                  onClick={() => setFilter(active ? "all" : verdict)}
                  className={`rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
                    active ? style.tab : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
                    <Icon className="h-3.5 w-3.5" />
                    {style.label}
                  </span>
                  <span className="text-2xl font-bold">{counts[verdict]}</span>
                </button>
              );
            })}
          </div>

          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search ad, campaign or ad set…"
                className={`${sizeInputClass} pl-8`}
              />
            </label>
            <div className="flex items-center gap-2">
              <select
                aria-label="Sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-700"
              >
                <option value="best">Best first</option>
                <option value="spend">Most spend</option>
                <option value="roas">Highest ROAS</option>
                <option value="ctr">Highest CTR</option>
                <option value="newest">Newest</option>
              </select>
              <label className="flex cursor-pointer items-center gap-2 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-700">
                <input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} className="accent-black" />
                Active only
              </label>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
              {ads.length === 0 ? "No ads delivered in this period." : "No creatives match these filters."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((row) => (
                <CreativeCard key={row.ad.id} row={row} goal={goal} money={money} onOpen={() => setSelectedId(row.ad.id)} />
              ))}
            </div>
          )}

          <p className="mt-4 text-[11px] text-zinc-400">
            {account.name} · {account.currency}
            {shown.fetchedAt
              ? ` · Updated ${new Date(shown.fetchedAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}`
              : ""}
          </p>
        </>
      ) : null}

      {selected && account ? (
        <CreativeDetail
          row={selected}
          goal={goal}
          money={money}
          account={account}
          demo={demo}
          tips={creativeTips(selected, rules, goal, money, bench)}
          related={recs.filter((rec) => rec.adIds.includes(selected.ad.id))}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      {rulesOpen ? (
        <RulesPanel
          rules={rules}
          money={money}
          dirty={rulesDirty}
          saving={savingRules}
          saved={rulesSaved}
          onChange={setRules}
          onSave={saveRules}
          onReset={() => setRules(DEFAULT_AD_RULES)}
          onDiscard={() => setRules(savedRules)}
          onClose={() => setRulesOpen(false)}
        />
      ) : null}
    </div>
  );
}

function ConnectCard({ onPreview }: { onPreview: () => void }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white">
          <Plug className="h-5 w-5" />
        </span>
        <div className="min-w-0 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-black">Connect your Meta ad account</h2>
            <p className="mt-1 text-sm text-zinc-500">The page reads your ads; it never changes them.</p>
          </div>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-700">
            <li>
              In Meta Business Settings → Users → <b>System users</b>, create a system user and give it access to your ad
              account.
            </li>
            <li>
              Generate a token with the <code className="rounded bg-zinc-100 px-1">ads_read</code> permission.
            </li>
            <li>
              Add these to your environment variables (Vercel → Settings → Environment Variables), then redeploy:
              <pre className="mt-2 overflow-x-auto rounded bg-zinc-950 px-3 py-2 text-xs text-zinc-100">
                {"META_ACCESS_TOKEN=EAAB...\nMETA_AD_ACCOUNT_ID=1234567890"}
              </pre>
            </li>
          </ol>
          <p className="text-xs text-zinc-500">
            Sales and ROAS need the Meta pixel on the site. Without it, creatives are judged on clicks.
          </p>
          <button type="button" onClick={onPreview} className={`${sizeGhostButton} py-2`}>
            <Play className="h-3.5 w-3.5" />
            Preview with sample data
          </button>
        </div>
      </div>
    </div>
  );
}

function GoalNote({
  goal,
  rules,
  money,
  singleDay,
}: {
  goal: Exclude<AdGoal, "auto">;
  rules: AdRules;
  money: (v: number) => string;
  singleDay: boolean;
}) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
      {singleDay ? (
        <span>
          One day of data: good for checking today&apos;s spend and sales, but most creatives will still show as{" "}
          <b className="text-black">testing</b>. Switch to <b className="text-black">7 days</b> before deciding what to
          pause or scale.
        </span>
      ) : goal === "purchases" ? (
        <span>
          Judged on <b className="text-black">sales</b>. Each creative gets{" "}
          <b className="text-black">{money(testBudget(rules))}</b> to prove itself. Winning means {rules.minPurchases}+
          sales at a ROAS of {rules.targetRoas}× or better.
        </span>
      ) : (
        <span>
          Judged on <b className="text-black">clicks</b>
          {rules.goal === "auto" ? " because Meta reported no sales for this period" : ""}. Each creative needs{" "}
          {count(rules.minImpressions)} impressions; winning means {rules.targetCtr}%+ CTR at {money(rules.targetCpc)} or
          less per click.
        </span>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p
        className={`mt-0.5 text-2xl font-bold ${tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-600" : "text-black"}`}
      >
        {value}
      </p>
      {sub ? <p className="text-[11px] text-zinc-400">{sub}</p> : null}
    </div>
  );
}

function NoPreview() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-400">
      <ImageOff className="h-6 w-6" />
      <span className="text-[10px] font-semibold uppercase tracking-wider">No preview</span>
    </div>
  );
}

function Thumb({ ad, className }: { ad: AdCreative; className: string }) {
  const [broken, setBroken] = useState(false);
  const main = ad.media[0];
  return (
    <div className={`relative overflow-hidden bg-zinc-100 ${className}`}>
      {main && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={main.image}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <NoPreview />
      )}
      {ad.media.length > 1 ? (
        <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold text-white">
          <Layers className="h-3 w-3" />
          {ad.media.length}
        </span>
      ) : ad.isVideo ? (
        <span className="absolute right-2 bottom-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white">
          <Play className="h-3.5 w-3.5 fill-current" />
        </span>
      ) : null}
    </div>
  );
}

/** Full-quality viewer: plays the video when Meta shares the file, shows every carousel card. */
function MediaViewer({ ad }: { ad: AdCreative }) {
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState<Record<number, boolean>>({});
  const current = ad.media[index];

  if (!current) {
    return (
      <div className="aspect-square w-full overflow-hidden rounded-lg">
        <NoPreview />
      </div>
    );
  }

  const ratio = current.width && current.height ? `${current.width} / ${current.height}` : undefined;
  return (
    <div className="space-y-2">
      <div
        className="relative flex max-h-[60vh] w-full items-center justify-center overflow-hidden rounded-lg bg-zinc-950"
        style={{ aspectRatio: ratio ?? "4 / 5" }}
      >
        {current.videoUrl ? (
          <video
            key={current.videoUrl}
            src={current.videoUrl}
            poster={current.image}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full object-contain"
          />
        ) : broken[index] ? (
          <NoPreview />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current.image}
            src={current.image}
            alt=""
            referrerPolicy="no-referrer"
            decoding="async"
            onError={() => setBroken((state) => ({ ...state, [index]: true }))}
            className="h-full w-full object-contain"
          />
        )}
        {current.isVideo && !current.videoUrl ? (
          <span className="absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            Video cover · play it in Ads Manager
          </span>
        ) : null}
        {ad.media.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous"
              onClick={() => setIndex((i) => (i - 1 + ad.media.length) % ad.media.length)}
              className="absolute top-1/2 left-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow hover:bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => setIndex((i) => (i + 1) % ad.media.length)}
              className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow hover:bg-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span className="tabular-nums">
          {ad.media.length > 1 ? `${index + 1} / ${ad.media.length} · ` : ""}
          {current.width && current.height ? `${current.width}×${current.height}px` : "Original size"}
        </span>
        <a
          href={current.videoUrl ?? current.image}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-zinc-700 hover:text-black"
        >
          <Maximize2 className="h-3 w-3" />
          Full size
        </a>
      </div>

      {ad.media.length > 1 ? (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {ad.media.map((item, i) => (
            <button
              key={`${item.image}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show ${i + 1}`}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded border-2 ${i === index ? "border-black" : "border-transparent opacity-70 hover:opacity-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
              {item.isVideo ? <Play className="absolute right-1 bottom-1 h-3 w-3 fill-white text-white" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function VerdictBadge({ verdict, headline }: { verdict: Verdict; headline: string }) {
  const style = VERDICT_STYLE[verdict];
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ${style.badge}`}>
      <Icon className="h-3 w-3" />
      {headline}
    </span>
  );
}

function Progress({ value, verdict, label }: { value: number; verdict: Verdict; label: string }) {
  return (
    <div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full ${VERDICT_STYLE[verdict].bar}`} style={{ width: `${Math.min(100, Math.max(4, value * 100))}%` }} />
      </div>
      <p className="mt-1 text-[10px] font-medium text-zinc-500">{label}</p>
    </div>
  );
}

function metricCells(row: Row, goal: Exclude<AdGoal, "auto">, money: (v: number) => string) {
  const { ad, m } = row;
  if (goal === "purchases") {
    return [
      { label: "Spend", value: money(ad.spend) },
      { label: "ROAS", value: m.roas !== null && ad.revenue > 0 ? `${m.roas.toFixed(2)}×` : "—" },
      { label: "Per sale", value: m.cpa !== null ? money(m.cpa) : "—" },
      { label: "Sales", value: count(ad.purchases) },
      { label: "CTR", value: ad.impressions > 0 ? pct(m.ctr) : "—" },
      { label: m.hookRate !== null ? "Hook" : "CPC", value: m.hookRate !== null ? `${m.hookRate.toFixed(0)}%` : ad.linkClicks > 0 ? money(m.cpc) : "—" },
    ];
  }
  return [
    { label: "Spend", value: money(ad.spend) },
    { label: "CTR", value: ad.impressions > 0 ? pct(m.ctr) : "—" },
    { label: "CPC", value: ad.linkClicks > 0 ? money(m.cpc) : "—" },
    { label: "Clicks", value: count(ad.linkClicks) },
    { label: "Impr.", value: count(ad.impressions) },
    { label: m.hookRate !== null ? "Hook" : "CPM", value: m.hookRate !== null ? `${m.hookRate.toFixed(0)}%` : money(m.cpm) },
  ];
}

function CreativeCard({
  row,
  goal,
  money,
  onOpen,
}: {
  row: Row;
  goal: Exclude<AdGoal, "auto">;
  money: (v: number) => string;
  onOpen: () => void;
}) {
  const { ad, j } = row;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md"
    >
      <div className="relative">
        <Thumb ad={ad} className="aspect-[4/5] w-full" />
        <span className="absolute top-2 left-2">
          <VerdictBadge verdict={j.verdict} headline={j.headline} />
        </span>
        {ad.status !== "ACTIVE" ? (
          <span className="absolute top-2 right-2 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
            {ad.status === "UNKNOWN" ? "Off" : "Paused"}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-black" title={ad.name}>
            {ad.name}
          </p>
          <p className="truncate text-[11px] text-zinc-400" title={`${ad.campaign} · ${ad.adset}`}>
            {ad.campaign || "—"}
          </p>
        </div>
        <p className="line-clamp-2 text-xs leading-snug text-zinc-600">{j.reason}</p>
        {j.progress !== null && j.progressLabel ? <Progress value={j.progress} verdict={j.verdict} label={j.progressLabel} /> : null}
        <dl className="mt-auto grid grid-cols-3 gap-x-2 gap-y-1.5 border-t border-zinc-100 pt-2.5">
          {metricCells(row, goal, money).map((cell) => (
            <div key={cell.label} className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{cell.label}</dt>
              <dd className="truncate text-xs font-bold tabular-nums text-black">{cell.value}</dd>
            </div>
          ))}
        </dl>
        {j.flags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {j.flags.map((flag) => (
              <span key={flag.label} title={flag.hint} className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${FLAG_STYLE[flag.tone]}`}>
                {flag.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}

function CreativeDetail({
  row,
  goal,
  money,
  account,
  demo,
  tips,
  related,
  onClose,
}: {
  row: Row;
  goal: Exclude<AdGoal, "auto">;
  money: (v: number) => string;
  account: AdAccount;
  demo: boolean;
  tips: Tip[];
  related: Recommendation[];
  onClose: () => void;
}) {
  const { ad, m, j } = row;
  const style = VERDICT_STYLE[j.verdict];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const funnel = [
    { label: "Impressions", value: ad.impressions },
    { label: "Link clicks", value: ad.linkClicks },
    { label: "Add to cart", value: ad.addToCart },
    { label: "Checkout", value: ad.checkouts },
    { label: "Sales", value: ad.purchases },
  ];
  const stats = [
    { label: "Spend", value: money(ad.spend) },
    { label: "Revenue", value: ad.revenue > 0 ? money(ad.revenue) : "—" },
    { label: "ROAS", value: m.roas !== null && ad.revenue > 0 ? `${m.roas.toFixed(2)}×` : "—" },
    { label: "Cost per sale", value: m.cpa !== null ? money(m.cpa) : "—" },
    { label: "CTR (link)", value: ad.impressions > 0 ? pct(m.ctr) : "—" },
    { label: "Cost per click", value: ad.linkClicks > 0 ? money(m.cpc) : "—" },
    { label: "CPM", value: ad.impressions > 0 ? money(m.cpm) : "—" },
    { label: "Frequency", value: ad.frequency > 0 ? `${ad.frequency.toFixed(2)}×` : "—" },
    { label: "Reach", value: count(ad.reach) },
    ...(m.hookRate !== null ? [{ label: "Hook rate (3s)", value: `${m.hookRate.toFixed(1)}%` }] : []),
    ...(m.holdRate !== null ? [{ label: "Hold rate", value: `${m.holdRate.toFixed(1)}%` }] : []),
    { label: "Live for", value: m.daysLive ? `${m.daysLive} day${m.daysLive > 1 ? "s" : ""}` : "—" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal aria-label={ad.name}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl sm:rounded-xl">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-black">{ad.name}</p>
            <p className="truncate text-xs text-zinc-500">
              {ad.campaign} {ad.adset ? `· ${ad.adset}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-black">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid overflow-y-auto md:grid-cols-[minmax(0,400px)_1fr]">
          <div className="space-y-3 border-zinc-200 p-5 md:border-r">
            <MediaViewer key={ad.id} ad={ad} />
            {ad.title ? <p className="text-sm font-semibold text-black">{ad.title}</p> : null}
            {ad.body ? <p className="whitespace-pre-line text-xs leading-relaxed text-zinc-600">{ad.body}</p> : null}
            {!demo ? (
              <a
                href={adsManagerUrl(account.id, ad.id)}
                target="_blank"
                rel="noreferrer"
                className={`${sizeGhostButton} w-full justify-center py-2`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Ads Manager
              </a>
            ) : null}
          </div>

          <div className="space-y-5 p-5">
            <div className={`rounded-lg border-2 p-4 ${style.tab}`}>
              <VerdictBadge verdict={j.verdict} headline={j.headline} />
              <p className="mt-2 text-sm font-medium">{j.reason}</p>
              {j.progress !== null && j.progressLabel ? (
                <div className="mt-3">
                  <Progress value={j.progress} verdict={j.verdict} label={j.progressLabel} />
                </div>
              ) : null}
              <p className="mt-3 text-xs font-semibold">{nextStep(j.verdict, goal)}</p>
            </div>

            {related.length > 0 ? (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  <Lightbulb className="h-3.5 w-3.5" />
                  Recommended
                </p>
                <ul className="space-y-2">
                  {related.map((rec) => (
                    <li key={rec.id} className="rounded-lg border border-zinc-200 p-3">
                      <p className="text-sm font-semibold text-black">{rec.title}</p>
                      {rec.steps[0] ? <p className="mt-0.5 text-xs text-zinc-600">{rec.steps[0]}</p> : null}
                      {rec.gain ? <p className="mt-1 text-xs font-bold text-emerald-700">{rec.gain}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {tips.length > 0 ? (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Diagnosis</p>
                <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200">
                  {tips.map((tip) => {
                    const Icon = TIP_STYLE[tip.tone].icon;
                    return (
                      <li key={tip.title} className="flex gap-3 px-3 py-2.5">
                        <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${TIP_STYLE[tip.tone].className}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-black">{tip.title}</span>
                          <span className="block text-xs leading-relaxed text-zinc-600">{tip.detail}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Funnel</p>
              <div className="space-y-1.5">
                {funnel.map((step, index) => {
                  const top = funnel[0].value || 1;
                  const previous = index > 0 ? funnel[index - 1].value : 0;
                  const width = step.value > 0 ? Math.max(2, Math.sqrt(step.value / top) * 100) : 0;
                  return (
                    <div key={step.label} className="grid grid-cols-[96px_1fr_auto] items-center gap-3 text-xs">
                      <span className="text-zinc-500">{step.label}</span>
                      <div className="h-5 overflow-hidden rounded bg-zinc-100">
                        <div className="h-full rounded bg-black" style={{ width: `${width}%` }} />
                      </div>
                      <span className="w-24 text-right tabular-nums">
                        <b className="text-black">{count(step.value)}</b>
                        {index > 0 && previous > 0 ? (
                          <span className="ml-1 text-zinc-400">{((step.value / previous) * 100).toFixed(index === 1 ? 2 : 0)}%</span>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 sm:grid-cols-3">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-white px-3 py-2.5">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{stat.label}</dt>
                  <dd className="text-sm font-bold tabular-nums text-black">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function nextStep(verdict: Verdict, goal: Exclude<AdGoal, "auto">) {
  switch (verdict) {
    case "winner":
      return "Next: raise the budget 20–30% every few days, or duplicate it into your scaling campaign.";
    case "promising":
      return goal === "purchases"
        ? "Next: keep it running untouched until it has enough sales to confirm."
        : "Next: keep it running and test a variation of the weaker part.";
    case "testing":
      return "Next: don't touch it yet. Editing now resets learning and wastes the test.";
    case "loser":
      return "Next: pause it and test a new hook or angle instead.";
  }
}

function RuleInput({
  id,
  label,
  hint,
  value,
  step,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={sizeLabelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          min={0}
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(event) => onChange(Number(event.target.value))}
          className={`${sizeInputClass} ${suffix ? "pr-10" : ""}`}
        />
        {suffix ? <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-zinc-400">{suffix}</span> : null}
      </div>
      {hint ? <p className="text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function RulesPanel({
  rules,
  money,
  dirty,
  saving,
  saved,
  onChange,
  onSave,
  onReset,
  onDiscard,
  onClose,
}: {
  rules: AdRules;
  money: (v: number) => string;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  onChange: (rules: AdRules) => void;
  onSave: () => void;
  onReset: () => void;
  onDiscard: () => void;
  onClose: () => void;
}) {
  const set = <K extends keyof AdRules>(key: K, value: AdRules[K]) => onChange({ ...rules, [key]: value });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal aria-label="Verdict rules">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <p className="flex items-center gap-2 font-bold text-black">
              <SlidersHorizontal className="h-4 w-4" />
              Verdict rules
            </p>
            <p className="text-xs text-zinc-500">Verdicts update live as you type.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-black">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <div className="space-y-1.5">
            <p className={sizeLabelClass}>Judge creatives on</p>
            <div className="flex rounded border border-zinc-300 p-0.5">
              {(
                [
                  ["auto", "Auto"],
                  ["purchases", "Sales"],
                  ["clicks", "Clicks"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set("goal", value)}
                  className={`flex-1 rounded-sm py-1.5 text-xs font-semibold uppercase tracking-wider ${
                    rules.goal === value ? "bg-black text-white" : "text-zinc-600 hover:text-black"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500">Auto uses sales when the pixel reports any, otherwise clicks.</p>
          </div>

          <fieldset className="space-y-3 rounded-lg border border-zinc-200 p-4">
            <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Sales</legend>
            <RuleInput
              id="rule-cpa"
              label="Target cost per sale"
              hint="The most you can pay for one sale and still make money."
              value={rules.targetCpa}
              step={1}
              onChange={(v) => set("targetCpa", v)}
            />
            <div className="grid grid-cols-2 gap-3">
              <RuleInput id="rule-be" label="Break-even ROAS" value={rules.breakEvenRoas} step={0.1} suffix="×" onChange={(v) => set("breakEvenRoas", v)} />
              <RuleInput id="rule-roas" label="Winning ROAS" value={rules.targetRoas} step={0.1} suffix="×" onChange={(v) => set("targetRoas", v)} />
            </div>
            <RuleInput
              id="rule-budget"
              label="Test budget"
              hint={`Times the target cost per sale: each creative gets ${money(testBudget(rules))} before it is judged.`}
              value={rules.testBudgetMultiplier}
              step={0.5}
              suffix="×"
              onChange={(v) => set("testBudgetMultiplier", v)}
            />
            <RuleInput
              id="rule-sales"
              label="Sales needed to call a winner"
              value={rules.minPurchases}
              step={1}
              onChange={(v) => set("minPurchases", v)}
            />
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-zinc-200 p-4">
            <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Clicks &amp; attention</legend>
            <RuleInput
              id="rule-impr"
              label="Impressions before judging"
              value={rules.minImpressions}
              step={500}
              onChange={(v) => set("minImpressions", v)}
            />
            <div className="grid grid-cols-2 gap-3">
              <RuleInput id="rule-ctr" label="Good CTR" value={rules.targetCtr} step={0.1} suffix="%" onChange={(v) => set("targetCtr", v)} />
              <RuleInput id="rule-cpc" label="Max cost per click" value={rules.targetCpc} step={0.05} onChange={(v) => set("targetCpc", v)} />
            </div>
            <RuleInput
              id="rule-freq"
              label="Fatigue frequency"
              hint="Flag a creative when people have seen it this many times on average."
              value={rules.maxFrequency}
              step={0.5}
              suffix="×"
              onChange={(v) => set("maxFrequency", v)}
            />
          </fieldset>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-5 py-3">
          <button type="button" onClick={onReset} className={sizeGhostButton}>
            <RotateCcw className="h-3.5 w-3.5" />
            Defaults
          </button>
          <div className="flex items-center gap-2">
            {dirty ? (
              <button type="button" onClick={onDiscard} className={sizeGhostButton}>
                Discard
              </button>
            ) : null}
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || saving}
              className={`inline-flex items-center gap-1.5 rounded px-5 py-2 text-xs font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed ${
                saved ? "bg-emerald-600 text-white" : "bg-black text-white hover:bg-zinc-800 disabled:bg-zinc-300"
              }`}
            >
              {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {saved ? "Saved" : saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
