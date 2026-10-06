/**
 * Size charts per product type (keyed by category slug). Each chart holds the garment
 * measurements shown to customers and, per size, the body height/weight ranges the
 * size finder matches against. Types without a saved chart use the standard below.
 */

export type Gender = "men" | "women";
export type FitPreference = "slim" | "regular" | "loose";

export type BodyRange = {
  heightMin: number | null;
  heightMax: number | null;
  weightMin: number | null;
  weightMax: number | null;
};

export type SizeChartRow = {
  size: string;
  /** One entry per `columns` label; free text so ranges like "55–57" are allowed. */
  values: string[];
  men: BodyRange;
  women: BodyRange;
};

export type SizeChart = {
  slug: string;
  title: string;
  /** Shows the size guide link on product pages of this type. */
  enabled: boolean;
  /** Shows the height/weight size finder; off for headwear and one-size items. */
  finderEnabled: boolean;
  /** Measurement column labels; the size column is implicit. */
  columns: string[];
  rows: SizeChartRow[];
  fitNote: string;
  howToMeasure: string[];
  /** True when the chart was edited in the back office. */
  isCustom?: boolean;
  updatedAt?: string | null;
};

export const HEIGHT_LIMITS = { min: 140, max: 210 } as const;
export const WEIGHT_LIMITS = { min: 40, max: 150 } as const;

const EMPTY_RANGE: BodyRange = { heightMin: null, heightMax: null, weightMin: null, weightMax: null };

const range = (h: [number, number], w: [number, number]): BodyRange => ({
  heightMin: h[0],
  heightMax: h[1],
  weightMin: w[0],
  weightMax: w[1],
});

/** Standard unisex body ranges (cm / kg) per size. */
const BODY: Record<string, { men: BodyRange; women: BodyRange }> = {
  XS: { men: range([160, 167], [50, 58]), women: range([150, 158], [42, 50]) },
  S: { men: range([165, 172], [57, 66]), women: range([156, 164], [49, 57]) },
  M: { men: range([170, 178], [65, 75]), women: range([162, 170], [56, 65]) },
  L: { men: range([176, 184], [74, 84]), women: range([168, 176], [64, 74]) },
  XL: { men: range([182, 190], [83, 95]), women: range([174, 182], [73, 84]) },
  XXL: { men: range([188, 196], [94, 108]), women: range([180, 188], [83, 95]) },
};

const LETTER_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

/** Sizes offered as one-click additions in the back office. */
export const COMMON_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;

const EXTRA_BODY: Record<string, { men: BodyRange; women: BodyRange }> = {
  XXS: { men: range([155, 162], [44, 51]), women: range([145, 152], [38, 43]) },
  XXXL: { men: range([192, 200], [106, 122]), women: range([184, 192], [93, 108]) },
};

/** Standard body ranges for a letter size, or empty ranges for anything else. */
export function standardBodyRange(size: string): { men: BodyRange; women: BodyRange } {
  const key = size.trim().toUpperCase().replace(/^2XL$/, "XXL").replace(/^3XL$/, "XXXL");
  const found = BODY[key] ?? EXTRA_BODY[key];
  return found
    ? { men: { ...found.men }, women: { ...found.women } }
    : { men: { ...EMPTY_RANGE }, women: { ...EMPTY_RANGE } };
}

function letterRows(values: string[][]): SizeChartRow[] {
  return LETTER_SIZES.map((size, i) => ({
    size,
    values: values[i] ?? [],
    men: { ...BODY[size].men },
    women: { ...BODY[size].women },
  }));
}

const TOP_MEASURE = [
  "Chest: lay the garment flat and measure 2 cm under the armholes, side to side.",
  "Length: from the highest point of the shoulder straight down to the hem.",
  "Shoulder: seam to seam across the back.",
  "Sleeve: from the shoulder seam to the end of the sleeve.",
];

type Template = Omit<SizeChart, "slug" | "title" | "isCustom" | "updatedAt">;

const TEMPLATES: Record<string, Template> = {
  "t-shirts": {
    enabled: true,
    finderEnabled: true,
    columns: ["Chest", "Length", "Shoulder", "Sleeve"],
    rows: letterRows([
      ["50", "66", "45", "20"],
      ["53", "69", "48", "21"],
      ["56", "72", "51", "22"],
      ["59", "74", "54", "23"],
      ["62", "76", "57", "24"],
      ["65", "78", "60", "25"],
    ]),
    fitNote: "Boxy fit. Size down for a classic straight fit.",
    howToMeasure: TOP_MEASURE,
  },
  sweatshirts: {
    enabled: true,
    finderEnabled: true,
    columns: ["Chest", "Length", "Shoulder", "Sleeve"],
    rows: letterRows([
      ["54", "66", "48", "60"],
      ["57", "68", "51", "61"],
      ["60", "70", "54", "62"],
      ["63", "72", "57", "63"],
      ["66", "74", "60", "64"],
      ["69", "76", "63", "65"],
    ]),
    fitNote: "Relaxed fit with a dropped shoulder.",
    howToMeasure: TOP_MEASURE,
  },
  hoodies: {
    enabled: true,
    finderEnabled: true,
    columns: ["Chest", "Length", "Shoulder", "Sleeve"],
    rows: letterRows([
      ["56", "68", "50", "61"],
      ["59", "70", "53", "62"],
      ["62", "72", "56", "63"],
      ["65", "74", "59", "64"],
      ["68", "76", "62", "65"],
      ["71", "78", "65", "66"],
    ]),
    fitNote: "Oversized fit. Size down for a closer fit.",
    howToMeasure: TOP_MEASURE,
  },
  jackets: {
    enabled: true,
    finderEnabled: true,
    columns: ["Chest", "Length", "Shoulder", "Sleeve"],
    rows: letterRows([
      ["57", "66", "47", "62"],
      ["60", "68", "49", "63"],
      ["63", "70", "51", "64"],
      ["66", "72", "53", "65"],
      ["69", "74", "55", "66"],
      ["72", "76", "57", "67"],
    ]),
    fitNote: "Regular fit, room for a hoodie underneath.",
    howToMeasure: TOP_MEASURE,
  },
  knitwear: {
    enabled: true,
    finderEnabled: true,
    columns: ["Chest", "Length", "Shoulder", "Sleeve"],
    rows: letterRows([
      ["52", "64", "46", "59"],
      ["55", "66", "48", "60"],
      ["58", "68", "50", "61"],
      ["61", "70", "52", "62"],
      ["64", "72", "54", "63"],
      ["67", "74", "56", "64"],
    ]),
    fitNote: "Regular fit. Knit relaxes slightly with wear.",
    howToMeasure: TOP_MEASURE,
  },
  sweatpants: {
    enabled: true,
    finderEnabled: true,
    columns: ["Waist", "Length"],
    rows: letterRows([
      ["66–72", "98"],
      ["72–78", "100"],
      ["78–84", "102"],
      ["84–92", "104"],
      ["92–100", "106"],
      ["100–108", "108"],
    ]),
    fitNote: "Relaxed straight leg. Elastic waistband.",
    howToMeasure: [
      "Waist: wrap a tape around your natural waist, snug but not tight. The elastic waistband fits the range shown.",
      "Length: outside leg, from the top of the waistband straight down to the hem.",
    ],
  },
  hats: {
    enabled: true,
    finderEnabled: false,
    columns: ["Circumference", "Crown height"],
    rows: [
      { size: "S/M", values: ["55–57", "12"], men: { ...EMPTY_RANGE }, women: { ...EMPTY_RANGE } },
      { size: "L/XL", values: ["58–61", "12"], men: { ...EMPTY_RANGE }, women: { ...EMPTY_RANGE } },
      { size: "One size", values: ["54–61", "11"], men: { ...EMPTY_RANGE }, women: { ...EMPTY_RANGE } },
    ],
    fitNote: "Adjustable strap on one-size caps.",
    howToMeasure: ["Head: wrap a tape 1 cm above the ears, keeping it level all the way round."],
  },
};

/** Types that reuse another type's standard chart. */
const TEMPLATE_ALIASES: Record<string, string> = {
  "tops-jerseys": "t-shirts",
  womens: "t-shirts",
  bottoms: "sweatpants",
  shorts: "sweatpants",
  denim: "sweatpants",
};

export const STANDARD_TEMPLATES = [
  { key: "t-shirts", label: "T-shirt" },
  { key: "sweatshirts", label: "Sweatshirt" },
  { key: "hoodies", label: "Hoodie" },
  { key: "jackets", label: "Jacket" },
  { key: "knitwear", label: "Knitwear" },
  { key: "sweatpants", label: "Sweatpants" },
  { key: "hats", label: "Headwear" },
] as const;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Standard chart for a type; unknown types (bags, accessories…) start disabled. */
export function standardSizeChart(slug: string, title?: string, templateKey?: string): SizeChart {
  const key = templateKey ?? TEMPLATE_ALIASES[slug] ?? slug;
  const template = TEMPLATES[key];
  const base = template ? clone(template) : { ...clone(TEMPLATES["t-shirts"]), enabled: false };
  return { slug, title: title || titleFromSlug(slug), ...base, isCustom: false, updatedAt: null };
}

/* ------------------------------------------------------------------ */
/* Normalisation (DB / API input)                                      */
/* ------------------------------------------------------------------ */

const MAX_COLUMNS = 8;
const MAX_ROWS = 20;

function toNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n < 400 ? Math.round(n * 10) / 10 : null;
}

function toRange(raw: unknown): BodyRange {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    heightMin: toNumber(r.heightMin),
    heightMax: toNumber(r.heightMax),
    weightMin: toNumber(r.weightMin),
    weightMax: toNumber(r.weightMax),
  };
}

const text = (raw: unknown, max: number) => (typeof raw === "string" ? raw.trim().slice(0, max) : "");

/** Accepts anything (saved JSON or a request body) and returns a valid chart. */
export function normalizeSizeChart(raw: unknown, slug: string, title: string): SizeChart {
  const fallback = standardSizeChart(slug, title);
  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Record<string, unknown>;

  const columns = (Array.isArray(r.columns) ? r.columns : fallback.columns)
    .map((c) => text(c, 40))
    .slice(0, MAX_COLUMNS);

  const rows = (Array.isArray(r.rows) ? r.rows : [])
    .map((row): SizeChartRow | null => {
      const o = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
      const size = text(o.size, 24);
      if (!size) return null;
      const values = Array.isArray(o.values) ? o.values : [];
      return {
        size,
        values: columns.map((_, i) => text(values[i], 24)),
        men: toRange(o.men),
        women: toRange(o.women),
      };
    })
    .filter((row): row is SizeChartRow => row !== null)
    .slice(0, MAX_ROWS);

  return {
    slug,
    title: text(r.title, 60) || title || fallback.title,
    enabled: typeof r.enabled === "boolean" ? r.enabled : fallback.enabled,
    finderEnabled: typeof r.finderEnabled === "boolean" ? r.finderEnabled : fallback.finderEnabled,
    columns,
    rows,
    fitNote: text(r.fitNote, 240),
    howToMeasure: (Array.isArray(r.howToMeasure) ? r.howToMeasure : [])
      .map((line) => text(line, 240))
      .filter(Boolean)
      .slice(0, 10),
    isCustom: Boolean(r.isCustom),
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : null,
  };
}

/** Reasons a chart can't be saved yet (empty, unnamed or duplicate sizes). */
export function sizeChartProblems(chart: SizeChart): string[] {
  const list: string[] = [];
  if (chart.rows.length === 0) list.push("Add at least one size.");
  if (chart.rows.some((row) => !row.size.trim())) list.push("Every size needs a name.");
  const names = chart.rows.map((row) => row.size.trim().toUpperCase()).filter(Boolean);
  if (new Set(names).size !== names.length) list.push("Each size must be unique.");
  return list;
}

/* ------------------------------------------------------------------ */
/* Per-product override (stored in products.measurement_table)         */
/* ------------------------------------------------------------------ */

/**
 * `standard` follows the product type's chart, `custom` replaces it for this product
 * only, `off` hides the guide on this product.
 */
export type ProductSizeGuide =
  | { mode: "standard" }
  | { mode: "off" }
  | { mode: "custom"; chart: SizeChart };

/**
 * Reads `products.measurement_table`. Older rows hold a plain grid
 * (`[["Size","Chest"],["S","50"]]`); a grid with real values becomes a custom chart.
 */
export function parseProductSizeGuide(raw: unknown, slug: string, title: string): ProductSizeGuide {
  if (typeof raw === "string") {
    try {
      return parseProductSizeGuide(JSON.parse(raw), slug, title);
    } catch {
      return { mode: "standard" };
    }
  }
  if (Array.isArray(raw)) return legacyGrid(raw, slug, title);
  if (!raw || typeof raw !== "object") return { mode: "standard" };

  const r = raw as Record<string, unknown>;
  if (r.mode === "off") return { mode: "off" };
  if (r.mode === "custom" && r.chart) {
    const chart = { ...normalizeSizeChart(r.chart, slug, title), enabled: true, isCustom: true };
    return chart.rows.length > 0 ? { mode: "custom", chart } : { mode: "standard" };
  }
  return { mode: "standard" };
}

function legacyGrid(grid: unknown[], slug: string, title: string): ProductSizeGuide {
  const lines = grid.map((line) => (Array.isArray(line) ? line.map((c) => String(c ?? "").trim()) : []));
  const [header = [], ...body] = lines;
  const hasValues = body.some((line) => line.slice(1).some(Boolean));
  if (!hasValues) return { mode: "standard" };

  const base = standardSizeChart(slug, title);
  const columns = header.slice(1).map((c, i) => c || `Column ${i + 1}`);
  const chart = normalizeSizeChart(
    {
      ...base,
      columns,
      rows: body
        .filter((line) => line[0])
        .map((line) => ({ size: line[0], values: line.slice(1), ...standardBodyRange(line[0]) })),
    },
    slug,
    title,
  );
  return chart.rows.length > 0 ? { mode: "custom", chart: { ...chart, enabled: true, isCustom: true } } : { mode: "standard" };
}

/** Value written back to `products.measurement_table` (null = follow the type). */
export function serializeProductSizeGuide(guide: ProductSizeGuide): unknown {
  if (guide.mode === "off") return { mode: "off" };
  if (guide.mode === "custom") {
    const chart: Partial<SizeChart> = { ...guide.chart };
    delete chart.isCustom;
    delete chart.updatedAt;
    return { mode: "custom", chart };
  }
  return null;
}

/** The chart a product page shows, or null when it has no size guide. */
export function resolveProductSizeChart(
  guide: ProductSizeGuide | undefined,
  typeChart: SizeChart | null,
): SizeChart | null {
  if (guide?.mode === "off") return null;
  if (guide?.mode === "custom") {
    return { ...guide.chart, title: typeChart?.title || guide.chart.title, enabled: true };
  }
  return typeChart && typeChart.enabled && typeChart.rows.length > 0 ? typeChart : null;
}

/* ------------------------------------------------------------------ */
/* Size finder                                                         */
/* ------------------------------------------------------------------ */

export type FitProfile = {
  gender: Gender;
  height: number;
  weight: number;
  fit: FitPreference;
};

export type SizeRecommendation = {
  size: string;
  /** Neighbouring size when the profile sits between two. */
  alternative: string | null;
  /** Set when the profile is outside every range in the chart. */
  outOfRange: "below" | "above" | null;
};

type CompleteRange = { heightMin: number; heightMax: number; weightMin: number; weightMax: number };

function isComplete(r: BodyRange): r is CompleteRange {
  return r.heightMin !== null && r.heightMax !== null && r.weightMin !== null && r.weightMax !== null;
}

export function chartSupportsFinder(chart: SizeChart): boolean {
  return chart.finderEnabled && chart.rows.some((row) => isComplete(row.men) || isComplete(row.women));
}

const FIT_SHIFT: Record<FitPreference, number> = { slim: -1, regular: 0, loose: 1 };

/**
 * Scores every size by how far height and weight sit from the middle of its range
 * (weight counts more: it drives chest and waist), then applies the fit preference.
 */
export function recommendSize(chart: SizeChart, profile: FitProfile): SizeRecommendation | null {
  const candidates = chart.rows.flatMap((row) => {
    const r = row[profile.gender];
    return isComplete(r) ? [{ size: row.size, range: r }] : [];
  });
  if (candidates.length === 0) return null;

  const scored = candidates.map((c, position) => {
    const hHalf = Math.max(1, (c.range.heightMax - c.range.heightMin) / 2);
    const wHalf = Math.max(1, (c.range.weightMax - c.range.weightMin) / 2);
    const hScore = Math.abs(profile.height - (c.range.heightMin + hHalf)) / hHalf;
    const wScore = Math.abs(profile.weight - (c.range.weightMin + wHalf)) / wHalf;
    return { size: c.size, position, score: 0.4 * hScore + 0.6 * wScore };
  });

  const ranked = [...scored].sort((a, b) => a.score - b.score);
  const best = ranked[0];
  const second = ranked[1];

  const first = candidates[0].range;
  const last = candidates[candidates.length - 1].range;
  let outOfRange: SizeRecommendation["outOfRange"] = null;
  if (profile.weight < first.weightMin && profile.height < first.heightMax) outOfRange = "below";
  if (profile.weight > last.weightMax && profile.height > last.heightMin) outOfRange = "above";

  const position = Math.min(
    candidates.length - 1,
    Math.max(0, best.position + FIT_SHIFT[profile.fit]),
  );
  const size = candidates[position].size;

  const between =
    profile.fit === "regular" &&
    second &&
    Math.abs(second.position - best.position) === 1 &&
    second.score - best.score < 0.35;

  return { size, alternative: between ? second.size : null, outOfRange };
}

/* ------------------------------------------------------------------ */
/* Display helpers                                                     */
/* ------------------------------------------------------------------ */

/** Converts every number in a cm value ("55–57" → "21.7–22.4"). */
export function cmToInches(value: string): string {
  return value.replace(/\d+(?:[.,]\d+)?/g, (match) => {
    const inches = Number(match.replace(",", ".")) / 2.54;
    return (Math.round(inches * 10) / 10).toString();
  });
}

export const FIT_PROFILE_STORAGE_KEY = "cv:fit-profile";

export function parseFitProfile(raw: string | null): FitProfile | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<FitProfile>;
    if (p.gender !== "men" && p.gender !== "women") return null;
    const height = Number(p.height);
    const weight = Number(p.weight);
    if (!Number.isFinite(height) || height < HEIGHT_LIMITS.min || height > HEIGHT_LIMITS.max) return null;
    if (!Number.isFinite(weight) || weight < WEIGHT_LIMITS.min || weight > WEIGHT_LIMITS.max) return null;
    const fit: FitPreference = p.fit === "slim" || p.fit === "loose" ? p.fit : "regular";
    return { gender: p.gender, height, weight, fit };
  } catch {
    return null;
  }
}
