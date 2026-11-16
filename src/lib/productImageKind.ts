/**
 * Auto-detect whether a product photo is a packshot/cutout (product only)
 * or a lifestyle shot (person / scene). Used to pick contain+shadow vs cover.
 */

export type ProductImageKind = "cutout" | "lifestyle";

const memoryCache = new Map<string, ProductImageKind>();
/** Bump when classification rules change so stale session cache is ignored. */
const STORAGE_PREFIX = "classyv-imgkind:v2:";

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

/** Seed cache from SSR/props so later client mounts skip the cutout flash. */
export function seedProductImageKind(src: string, kind: ProductImageKind) {
  if (!src || (kind !== "cutout" && kind !== "lifestyle")) return;
  writeCache(src, kind);
}

type EdgeStats = {
  transparent: number;
  white: number;
  black: number;
  busy: number;
  total: number;
  skin: number;
};

function isSkinTone(r: number, g: number, b: number) {
  // Loose skin heuristic — catches faces/arms on model shots.
  return r > 60 && g > 30 && b > 20 && r > g && g >= b && r - b > 15 && r - g < 95;
}

function sampleRing(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  inset: number,
): EdgeStats {
  let transparent = 0;
  let white = 0;
  let black = 0;
  let busy = 0;
  let skin = 0;
  let total = 0;

  const visit = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
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
    if (r > 235 && g > 235 && b > 235) {
      white += 1;
      return;
    }
    if (r < 32 && g < 32 && b < 32) {
      black += 1;
      return;
    }
    busy += 1;
    if (isSkinTone(r, g, b)) skin += 1;
  };

  const x0 = inset;
  const y0 = inset;
  const x1 = width - 1 - inset;
  const y1 = height - 1 - inset;
  if (x1 <= x0 || y1 <= y0) {
    return { transparent, white, black, busy, total, skin };
  }

  for (let x = x0; x <= x1; x++) {
    visit(x, y0);
    visit(x, y1);
  }
  for (let y = y0 + 1; y < y1; y++) {
    visit(x0, y);
    visit(x1, y);
  }

  return { transparent, white, black, busy, total, skin };
}

function sampleInteriorSkin(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  let skin = 0;
  let total = 0;
  const x0 = Math.floor(width * 0.22);
  const x1 = Math.ceil(width * 0.78);
  const y0 = Math.floor(height * 0.12);
  const y1 = Math.ceil(height * 0.55);
  const stepX = Math.max(1, Math.floor((x1 - x0) / 12));
  const stepY = Math.max(1, Math.floor((y1 - y0) / 12));

  for (let y = y0; y < y1; y += stepY) {
    for (let x = x0; x < x1; x += stepX) {
      const i = (y * width + x) * 4;
      total += 1;
      const a = data[i + 3] ?? 0;
      if (a < 40) continue;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      if (isSkinTone(r, g, b)) skin += 1;
    }
  }

  return total > 0 ? skin / total : 0;
}

/**
 * Classify from RGBA samples: flat studio / alpha → cutout, busy edges /
 * skin → lifestyle. Person-on-black must not be treated as a packshot.
 */
export function classifyRgbaEdges(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): ProductImageKind {
  const outer = sampleRing(data, width, height, 0);
  if (outer.total <= 0) return "lifestyle";

  const alphaShare = outer.transparent / outer.total;
  const whiteShare = outer.white / outer.total;
  const blackShare = outer.black / outer.total;
  const flatShare = (outer.transparent + outer.white + outer.black) / outer.total;
  const busyShare = outer.busy / outer.total;
  const edgeSkinShare = outer.skin / outer.total;
  const interiorSkin = sampleInteriorSkin(data, width, height);

  // Transparent PNG/WebP cutouts.
  if (alphaShare >= 0.22) return "cutout";

  // Skin in frame → on-model / lifestyle (fill the cadre).
  if (edgeSkinShare >= 0.04 || interiorSkin >= 0.06) return "lifestyle";

  // Busy outer edge (clothes, floor, props) → lifestyle even on dark sets.
  if (busyShare >= 0.24) return "lifestyle";

  // Product on white studio paper.
  if (whiteShare >= 0.5) return "cutout";

  // Dark studio packshot: edges mostly black/flat and almost no busy content.
  if (blackShare >= 0.55 && busyShare < 0.16) return "cutout";
  if (flatShare >= 0.78 && busyShare < 0.18) return "cutout";

  // Inset ring still flat → floating packshot; otherwise content reaches the frame.
  const inset = Math.max(1, Math.round(Math.min(width, height) * 0.12));
  const inner = sampleRing(data, width, height, inset);
  if (inner.total > 0) {
    const innerBusy = inner.busy / inner.total;
    const innerSkin = inner.skin / inner.total;
    if (innerSkin >= 0.05 || innerBusy >= 0.3) return "lifestyle";
    if (innerBusy < 0.12 && flatShare >= 0.65) return "cutout";
  }

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

  const maxEdge = 96;
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
