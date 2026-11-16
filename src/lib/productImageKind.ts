/**
 * Auto-detect whether a product photo is a packshot/cutout (product only)
 * or a lifestyle shot (person / scene). Used to pick contain+shadow vs cover.
 */

export type ProductImageKind = "cutout" | "lifestyle";

const memoryCache = new Map<string, ProductImageKind>();
const STORAGE_PREFIX = "classyv-imgkind:";

function storageKey(src: string) {
  return `${STORAGE_PREFIX}${src.slice(0, 180)}`;
}

export function readCachedProductImageKind(src: string): ProductImageKind | null {
  const hit = memoryCache.get(src);
  if (hit) return hit;
  try {
    const raw = sessionStorage.getItem(storageKey(src));
    if (raw === "cutout" || raw === "lifestyle") {
      memoryCache.set(src, raw);
      return raw;
    }
  } catch {
    /* private mode */
  }
  return null;
}

function writeCache(src: string, kind: ProductImageKind) {
  memoryCache.set(src, kind);
  try {
    sessionStorage.setItem(storageKey(src), kind);
  } catch {
    /* private mode */
  }
}

function sampleEdge(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { transparent: number; white: number; black: number; total: number } {
  let transparent = 0;
  let white = 0;
  let black = 0;
  let total = 0;

  const visit = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    total += 1;
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const a = data[i + 3] ?? 0;
    if (a < 40) {
      transparent += 1;
      return;
    }
    if (r > 235 && g > 235 && b > 235) white += 1;
    else if (r < 32 && g < 32 && b < 32) black += 1;
  };

  for (let x = 0; x < width; x++) {
    visit(x, 0);
    visit(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    visit(0, y);
    visit(width - 1, y);
  }

  return { transparent, white, black, total };
}

/** Classify from RGBA edge samples: flat studio / alpha → cutout, busy edges → lifestyle. */
export function classifyRgbaEdges(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): ProductImageKind {
  const { transparent, white, black, total } = sampleEdge(data, width, height);
  if (total <= 0) return "lifestyle";

  const alphaShare = transparent / total;
  const whiteShare = white / total;
  const blackShare = black / total;
  const flatShare = (transparent + white + black) / total;

  // Transparent PNG/WebP cutouts.
  if (alphaShare >= 0.22) return "cutout";
  // Product on white or black studio paper/backdrop.
  if (whiteShare >= 0.5 || blackShare >= 0.5) return "cutout";
  if (flatShare >= 0.62) return "cutout";

  return "lifestyle";
}

/**
 * Sample a loaded <img> (same-origin /_next/image works). Falls back to lifestyle
 * if the canvas is tainted or the image is not ready.
 */
export function classifyImgElement(img: HTMLImageElement): ProductImageKind {
  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;
  if (!naturalW || !naturalH) return "lifestyle";

  const maxEdge = 72;
  const scale = Math.min(1, maxEdge / Math.max(naturalW, naturalH));
  const width = Math.max(8, Math.round(naturalW * scale));
  const height = Math.max(8, Math.round(naturalH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "lifestyle";

  try {
    ctx.drawImage(img, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    return classifyRgbaEdges(data, width, height);
  } catch {
    return "lifestyle";
  }
}

/** Classify + cache by source URL. */
export function detectProductImageKindFromImg(
  src: string,
  img: HTMLImageElement,
): ProductImageKind {
  const cached = readCachedProductImageKind(src);
  if (cached) return cached;
  const kind = classifyImgElement(img);
  writeCache(src, kind);
  return kind;
}
