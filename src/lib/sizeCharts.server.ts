import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { slugifyProductName } from "@/lib/productUrl";
import { normalizeSizeChart, standardSizeChart, titleFromSlug, type SizeChart } from "@/lib/sizeCharts";

type CategoryRow = { slug: string | null; name: string | null };
type ChartRow = { slug: string; data: unknown; updated_at: string | Date };

let tableReady = false;

export async function ensureSizeChartsTable() {
  if (tableReady) return;
  await neonQuery(`
    CREATE TABLE IF NOT EXISTS size_charts (
      slug text PRIMARY KEY,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  tableReady = true;
}

/** Same slug the storefront derives for a product's category. */
function categoryKey(row: CategoryRow): string {
  return slugifyProductName(row.slug) || slugifyProductName(row.name) || "";
}

function fromRow(row: ChartRow, title: string): SizeChart {
  const updatedAt = row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at);
  return { ...normalizeSizeChart(row.data, row.slug, title), isCustom: true, updatedAt };
}

async function loadSavedCharts(): Promise<Map<string, ChartRow>> {
  await ensureSizeChartsTable();
  const { rows } = await neonQuery<ChartRow>("SELECT slug, data, updated_at FROM size_charts");
  return new Map(rows.map((row) => [row.slug, row]));
}

/** One chart per back-office category, in category order. */
export async function getAllSizeCharts(): Promise<SizeChart[]> {
  noStore();
  if (!resolveDatabaseUrl()) return [];
  const [{ rows: categories }, saved] = await Promise.all([
    neonQuery<CategoryRow>("SELECT slug, name FROM categories ORDER BY sort_order ASC, name ASC"),
    loadSavedCharts(),
  ]);

  const seen = new Set<string>();
  const charts: SizeChart[] = [];
  for (const category of categories) {
    const slug = categoryKey(category);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const title = category.name?.trim() || titleFromSlug(slug);
    const row = saved.get(slug);
    charts.push(row ? fromRow(row, title) : standardSizeChart(slug, title));
  }
  return charts;
}

/** Chart for a product type, or null when the guide is turned off for it. */
export async function getSizeChart(slug: string, title?: string): Promise<SizeChart | null> {
  const chart = await getTypeSizeChart(slug, title);
  return chart.enabled && chart.rows.length > 0 ? chart : null;
}

/** Saved or standard chart for a product type, whether or not it is switched on. */
export async function getTypeSizeChart(slug: string, title?: string): Promise<SizeChart> {
  noStore();
  const name = title || titleFromSlug(slug);
  let chart = standardSizeChart(slug, name);
  if (resolveDatabaseUrl()) {
    try {
      await ensureSizeChartsTable();
      const { rows } = await neonQuery<ChartRow>(
        "SELECT slug, data, updated_at FROM size_charts WHERE slug = $1 LIMIT 1",
        [slug],
      );
      if (rows[0]) chart = fromRow(rows[0], name);
    } catch (err) {
      console.warn("[size-charts] falling back to the standard chart:", err instanceof Error ? err.message : err);
    }
  }
  return chart;
}

export async function saveSizeChart(chart: SizeChart): Promise<SizeChart> {
  await ensureSizeChartsTable();
  const data: Partial<SizeChart> = { ...chart };
  delete data.isCustom;
  delete data.updatedAt;
  const { rows } = await neonQuery<ChartRow>(
    `INSERT INTO size_charts (slug, data, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
     RETURNING slug, data, updated_at`,
    [chart.slug, JSON.stringify(data)],
  );
  return fromRow(rows[0], chart.title);
}

export async function resetSizeChart(slug: string): Promise<void> {
  await ensureSizeChartsTable();
  await neonQuery("DELETE FROM size_charts WHERE slug = $1", [slug]);
}
