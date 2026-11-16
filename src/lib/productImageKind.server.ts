import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  classifyRgbaEdges,
  type ProductImageKind,
} from "@/lib/productImageKind";
import { resolveMediaUrl } from "@/lib/mediaUrl";

const kindCache = new Map<string, ProductImageKind>();
const inflight = new Map<string, Promise<ProductImageKind>>();

async function readImageBytes(src: string): Promise<Buffer | null> {
  if (/^https?:\/\//i.test(src)) {
    try {
      const res = await fetch(src, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
  if (!src.startsWith("/")) return null;
  const publicDir = path.join(process.cwd(), "public");
  const relative = src.split("?")[0].replace(/^[/\\]+/, "");
  const filePath = path.join(publicDir, relative);
  if (!filePath.startsWith(publicDir)) return null;
  return fs.readFile(filePath).catch(() => null);
}

async function classifyBytes(bytes: Buffer): Promise<ProductImageKind> {
  const { data, info } = await sharp(bytes, { failOn: "none", limitInputPixels: 40_000_000 })
    .rotate()
    .resize(96, 96, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  if (!width || !height) return "cutout";

  return classifyRgbaEdges(new Uint8ClampedArray(data), width, height);
}

export async function detectProductImageKindFromUrl(src: string): Promise<ProductImageKind> {
  const url = resolveMediaUrl(src);
  if (!url || url.endsWith(".svg")) return "cutout";

  const cached = kindCache.get(url);
  if (cached) return cached;

  const pending = inflight.get(url);
  if (pending) return pending;

  const task = (async (): Promise<ProductImageKind> => {
    try {
      const bytes = await readImageBytes(url);
      if (!bytes) return "cutout";
      const kind = await classifyBytes(bytes);
      kindCache.set(url, kind);
      return kind;
    } catch {
      return "cutout";
    } finally {
      inflight.delete(url);
    }
  })();

  inflight.set(url, task);
  return task;
}

/** Resolve kinds for a product gallery — SSR so first paint is already correct. */
export async function resolveProductImageKinds(images: readonly string[]): Promise<ProductImageKind[]> {
  return Promise.all(images.map((src) => detectProductImageKindFromUrl(src)));
}
