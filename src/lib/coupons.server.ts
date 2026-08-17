import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import type { CartLine } from "@/lib/types";

/** A discount code resolved against the back office `coupons` table. */
export type AppliedCoupon = {
  code: string;
  /** Amount taken off the subtotal, already rounded to cents. */
  discount: number;
  /** Short human label, e.g. "10% off" or "5.00 DT off". */
  label: string;
};

export type CouponOutcome =
  | { ok: true; coupon: AppliedCoupon }
  | { ok: false; error: string };

type CouponRow = {
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: string | number;
  product_id: number | null;
  active: boolean;
  starts_at: string | null;
  expires_at: string | null;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Resolve a code against the coupons table and work out what it takes off.
 * Lines must already be priced server side so a tampered cart cannot inflate the discount.
 */
export async function applyCoupon(
  rawCode: string | null | undefined,
  lines: CartLine[]
): Promise<CouponOutcome> {
  const code = String(rawCode ?? "").trim();
  if (!code) return { ok: false, error: "Enter a discount code." };
  if (!resolveDatabaseUrl()) return { ok: false, error: "Discount codes are unavailable right now." };

  let row: CouponRow | undefined;
  try {
    const { rows } = await neonQuery<CouponRow>(
      `SELECT code, discount_type, discount_value, product_id, active, starts_at, expires_at
         FROM coupons
        WHERE lower(code) = lower($1)
        LIMIT 1`,
      [code]
    );
    row = rows[0];
  } catch {
    return { ok: false, error: "Discount codes are unavailable right now." };
  }

  if (!row) return { ok: false, error: "That code is not valid." };
  if (!row.active) return { ok: false, error: "That code is no longer active." };

  const now = Date.now();
  if (row.starts_at && new Date(row.starts_at).getTime() > now) {
    return { ok: false, error: "That code is not active yet." };
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < now) {
    return { ok: false, error: "That code has expired." };
  }

  // A coupon tied to a product only discounts that product's lines.
  const eligible = row.product_id == null
    ? lines
    : lines.filter((line) => line.productId === row!.product_id);
  const base = eligible.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  if (base <= 0) {
    return { ok: false, error: "That code does not apply to anything in your bag." };
  }

  const value = Number(row.discount_value) || 0;
  if (value <= 0) return { ok: false, error: "That code is not valid." };

  const discount =
    row.discount_type === "percent"
      ? round2(base * Math.min(value, 100) / 100)
      : round2(Math.min(value, base));

  if (discount <= 0) return { ok: false, error: "That code does not apply to anything in your bag." };

  return {
    ok: true,
    coupon: {
      code: row.code.toUpperCase(),
      discount,
      label: row.discount_type === "percent" ? `${value}% off` : `${value.toFixed(2)} DT off`,
    },
  };
}
