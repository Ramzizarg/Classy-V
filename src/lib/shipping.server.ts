import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { DEFAULT_SHIPPING_RATE, normalizeShippingRate } from "@/lib/shipping";

export async function ensureShippingSettingsTable() {
  await neonQuery(`
    CREATE TABLE IF NOT EXISTS shipping_settings (
      id text PRIMARY KEY,
      delivery_price numeric(12, 2) NOT NULL DEFAULT 8,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function getShippingRate(): Promise<number> {
  noStore();
  if (!resolveDatabaseUrl()) return DEFAULT_SHIPPING_RATE;

  try {
    const { rows } = await neonQuery<{ delivery_price: number | string }>(
      "SELECT delivery_price FROM shipping_settings WHERE id = $1 LIMIT 1",
      ["default"],
    );
    return normalizeShippingRate(rows[0]?.delivery_price);
  } catch {
    try {
      await ensureShippingSettingsTable();
    } catch {
      // Keep checkout operational with the safe default if the database is unavailable.
    }
    return DEFAULT_SHIPPING_RATE;
  }
}
