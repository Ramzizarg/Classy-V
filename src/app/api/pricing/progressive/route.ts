import { NextResponse } from "next/server";
import { allowRequest, clientIp } from "@/lib/rateLimit.server";
import { resolveDatabaseUrl } from "@/lib/neon-db";
import { getPublicProgressivePricing } from "@/lib/progressivePricing.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public aggregate pricing state only — never returns customer PII. */
export async function GET(request: Request) {
  if (!allowRequest(`progressive-pricing:${clientIp(request)}`, 60, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  if (!resolveDatabaseUrl()) {
    return NextResponse.json(
      {
        enabled: false,
        currentPrice: 55,
        deliveredOrders: 0,
        remaining: 10,
        nextPrice: 60,
        progressPct: 0,
        progressInLevel: 0,
        milestoneInterval: 10,
        priceIncrement: 5,
        level: 0,
        currency: "DT",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
        },
      },
    );
  }

  try {
    const payload = await getPublicProgressivePricing();
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
      },
    });
  } catch (error) {
    console.error("[pricing/progressive] failed:", error);
    return NextResponse.json({ error: "Could not load pricing." }, { status: 500 });
  }
}
