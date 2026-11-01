import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { DEFAULT_SHIPPING_RATE, normalizeShippingRate } from "@/lib/shipping";

const SHIPPING_CACHE_TAG = "shipping-rate";

export async function ensureShippingSettingsTable() {
  await neonQuery(`
    CREATE TABLE IF NOT EXISTS shipping_settings (
      id text PRIMARY KEY,
      delivery_price numeric(12, 2) NOT NULL DEFAULT 8,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function queryShippingRate(): Promise<number> {
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

/** Cached so the root layout does not force every storefront page to no-store. */
export const getShippingRate = unstable_cache(queryShippingRate, ["shipping-rate"], {
  revalidate: 60,
  tags: [SHIPPING_CACHE_TAG],
});

export function revalidateShippingRate() {
  revalidateTag(SHIPPING_CACHE_TAG, "max");
}
