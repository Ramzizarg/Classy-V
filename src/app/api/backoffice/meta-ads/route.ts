import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { resolveDatabaseUrl } from "@/lib/neon-db";
import { adRange, DEFAULT_AD_RULES } from "@/lib/metaAds";
import { getAdRules, getMetaAdsReport, MetaAdsError, metaAdsConfig, saveAdRules } from "@/lib/metaAds.server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const range = adRange(url.searchParams.get("range")).key;
  const rules = await getAdRules().catch((err) => {
    console.warn("[meta-ads] rules fallback:", err instanceof Error ? err.message : err);
    return DEFAULT_AD_RULES;
  });

  if (!metaAdsConfig()) {
    return NextResponse.json({ connected: false, rules });
  }

  try {
    const report = await getMetaAdsReport(range, url.searchParams.get("fresh") === "1");
    return NextResponse.json({ connected: true, rules, range, ...report });
  } catch (err) {
    console.error("[meta-ads] load failed:", err);
    const message = err instanceof MetaAdsError ? err.message : "Could not load your Facebook ads.";
    return NextResponse.json({ connected: true, rules, error: message }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!resolveDatabaseUrl()) {
    return NextResponse.json({ error: "The database is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { rules?: unknown } | null;
  if (!body?.rules || typeof body.rules !== "object") {
    return NextResponse.json({ error: "Invalid rules." }, { status: 400 });
  }

  try {
    return NextResponse.json({ rules: await saveAdRules(body.rules) });
  } catch (err) {
    console.error("[meta-ads] save rules failed:", err);
    return NextResponse.json({ error: "Could not save the rules." }, { status: 500 });
  }
}