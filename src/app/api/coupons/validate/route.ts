import { NextResponse } from "next/server";
import { isCartLine } from "@/lib/cart";
import { applyCoupon } from "@/lib/coupons.server";
import { priceCart } from "@/lib/pricing.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Previews a discount code for the cart. The order endpoint re-checks it on submit. */
export async function POST(request: Request) {
  let payload: { code?: string; lines?: unknown };
  try {
    payload = (await request.json()) as { code?: string; lines?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const requested = (Array.isArray(payload.lines) ? payload.lines : []).filter(isCartLine);
  if (requested.length === 0) {
    return NextResponse.json({ error: "Your bag is empty." }, { status: 400 });
  }

  const priced = await priceCart(requested);
  if (!priced.ok) {
    return NextResponse.json({ error: priced.error }, { status: priced.status });
  }

  const outcome = await applyCoupon(payload.code, priced.lines);
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: 422 });
  }

  return NextResponse.json({ coupon: outcome.coupon });
}
