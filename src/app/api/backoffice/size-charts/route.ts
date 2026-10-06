import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { resolveDatabaseUrl } from "@/lib/neon-db";
import { normalizeSizeChart, standardSizeChart } from "@/lib/sizeCharts";
import { getAllSizeCharts, resetSizeChart, saveSizeChart } from "@/lib/sizeCharts.server";

export const runtime = "nodejs";

async function guard() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!resolveDatabaseUrl()) {
    return NextResponse.json({ error: "The database is not configured." }, { status: 503 });
  }
  return null;
}

function slugParam(raw: unknown): string | null {
  return typeof raw === "string" && /^[a-z0-9-]{1,80}$/.test(raw) ? raw : null;
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  try {
    return NextResponse.json({ charts: await getAllSizeCharts() });
  } catch (err) {
    console.error("[size-charts] load failed:", err);
    return NextResponse.json({ error: "Could not load size charts." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as { chart?: Record<string, unknown> } | null;
  const slug = slugParam(body?.chart?.slug);
  if (!body?.chart || !slug) {
    return NextResponse.json({ error: "Invalid size chart." }, { status: 400 });
  }

  const chart = normalizeSizeChart(body.chart, slug, String(body.chart.title ?? ""));
  if (chart.rows.length === 0) {
    return NextResponse.json({ error: "Add at least one size." }, { status: 400 });
  }
  const sizes = chart.rows.map((row) => row.size.toUpperCase());
  if (new Set(sizes).size !== sizes.length) {
    return NextResponse.json({ error: "Each size must be unique." }, { status: 400 });
  }

  try {
    return NextResponse.json({ chart: await saveSizeChart(chart) });
  } catch (err) {
    console.error("[size-charts] save failed:", err);
    return NextResponse.json({ error: "Could not save the size chart." }, { status: 500 });
  }
}

/** Removes the saved chart so the type goes back to the standard table. */
export async function DELETE(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  const url = new URL(request.url);
  const slug = slugParam(url.searchParams.get("slug"));
  if (!slug) return NextResponse.json({ error: "Invalid type." }, { status: 400 });

  try {
    await resetSizeChart(slug);
    return NextResponse.json({ chart: standardSizeChart(slug, url.searchParams.get("title") ?? undefined) });
  } catch (err) {
    console.error("[size-charts] reset failed:", err);
    return NextResponse.json({ error: "Could not reset the size chart." }, { status: 500 });
  }
}
