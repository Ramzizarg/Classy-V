import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { DEFAULT_SHIPPING_RATE, normalizeShippingRate } from "@/lib/shipping";
import { ensureShippingSettingsTable, getShippingRate } from "@/lib/shipping.server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ deliveryPrice: await getShippingRate() });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { deliveryPrice?: unknown } | null;
  const rawPrice = Number(body?.deliveryPrice);
  if (!Number.isFinite(rawPrice) || rawPrice < 0 || rawPrice > 10000) {
    return NextResponse.json({ error: "Enter a delivery price between 0 and 10,000 DT." }, { status: 400 });
  }

  const deliveryPrice = normalizeShippingRate(rawPrice);
  if (!resolveDatabaseUrl()) {
    return NextResponse.json(
      { error: "The database is not configured. The default remains 8 DT." },
      { status: 503 },
    );
  }

  try {
    await ensureShippingSettingsTable();
    await neonQuery(
      `INSERT INTO shipping_settings (id, delivery_price, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (id) DO UPDATE
       SET delivery_price = EXCLUDED.delivery_price, updated_at = EXCLUDED.updated_at`,
      ["default", deliveryPrice],
    );
    return NextResponse.json({ ok: true, deliveryPrice });
  } catch {
    return NextResponse.json(
      { error: `Failed to save the delivery price. The default remains ${DEFAULT_SHIPPING_RATE} DT.` },
      { status: 500 },
    );
  }
}
