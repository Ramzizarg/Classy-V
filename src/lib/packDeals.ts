import { isJogger } from "@/lib/facebookCatalog";
import { isComingSoon, isSoldOut, productHoverImage } from "@/lib/products";
import type { CartLine, Product } from "@/lib/types";

/** Legacy fallback while older jogger rows have no `pack_deals` yet. */
export const LEGACY_JOGGER_DUO_PRICE = 120;

export type ProductPackDeals = {
  /** Singular storefront label, e.g. "baggy" or "jogger". */
  unitLabel: string;
  /** Total DT for a pack of 2; null/omitted = off. */
  two?: number | null;
  /** Total DT for a pack of 3; null/omitted = off. */
  three?: number | null;
};

export type ResolvedPackDeal = {
  unitLabel: string;
  two: number | null;
  three: number | null;
  /** Cart units sharing this key can complete a pack together (colour variants). */
  poolKey: string;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function positivePrice(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return round2(n);
}

/** Normalize jsonb / form payloads into a clean pack-deals object (or null when unset). */
export function parsePackDeals(raw: unknown): ProductPackDeals | null {
  if (raw == null) return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const unitLabel =
    typeof obj.unitLabel === "string"
      ? obj.unitLabel.trim()
      : typeof obj.unit_label === "string"
        ? obj.unit_label.trim()
        : "";
  const two = positivePrice(obj.two ?? obj.pack2 ?? obj.pack_2);
  const three = positivePrice(obj.three ?? obj.pack3 ?? obj.pack_3);
  return {
    unitLabel: unitLabel || "item",
    two,
    three,
  };
}

/**
 * Always persists an object from the back-office form.
 * Both packs off → `{ unitLabel, two: null, three: null }` (explicitly disabled, no legacy fallback).
 */
export function serializePackDeals(deals: ProductPackDeals | null | undefined): ProductPackDeals {
  const two = positivePrice(deals?.two);
  const three = positivePrice(deals?.three);
  const unitLabel = (deals?.unitLabel ?? "").trim() || "item";
  return { unitLabel, two, three };
}

export function packUnitPrice(packTotal: number, quantity: 2 | 3): number {
  return round2(packTotal / quantity);
}

export function packCompareAt(unitPrice: number, quantity: 2 | 3): number {
  return round2(unitPrice * quantity);
}

export function packSavings(unitPrice: number, packTotal: number, quantity: 2 | 3): number {
  return Math.max(0, packCompareAt(unitPrice, quantity) - packTotal);
}

/** Active pack deal for storefront / cart, with legacy jogger duo fallback. */
export function resolvePackDeal(product: Product): ResolvedPackDeal | null {
  // Column set from back office (even both packs off) — no legacy override.
  if (product.packDeals != null) {
    const configured = parsePackDeals(product.packDeals);
    if (!configured || (configured.two == null && configured.three == null)) return null;
    return {
      unitLabel: configured.unitLabel || "item",
      two: configured.two ?? null,
      three: configured.three ?? null,
      poolKey: product.variantGroup?.trim() || `product:${product.id}`,
    };
  }
  // Older jogger rows without pack_deals still get the classic 2-for-120 deal.
  if (isJogger(product)) {
    return {
      unitLabel: "jogger",
      two: LEGACY_JOGGER_DUO_PRICE,
      three: null,
      poolKey: "legacy:joggers",
    };
  }
  return null;
}

export function isPackDealEligible(product: Product): boolean {
  if (isComingSoon(product) || isSoldOut(product)) return false;
  return resolvePackDeal(product) != null;
}

/** Storefront label, e.g. "2 baggy" — use the unit label as typed in the back office. */
export function packLabel(quantity: number, unitLabel: string): string {
  const label = (unitLabel || "item").trim() || "item";
  return `${quantity} ${label}`;
}

function minPrice(values: Array<number | null | undefined>): number | null {
  let best: number | null = null;
  for (const value of values) {
    if (value == null || !(value > 0)) continue;
    if (best == null || value < best) best = value;
  }
  return best;
}

/**
 * Drop complete packs to the configured deal (prefer 3, then 2).
 * Leftover units keep their catalog sale price.
 */
export function applyPackPricing(
  lines: CartLine[],
  dealByLine: Array<ResolvedPackDeal | null>,
): CartLine[] {
  const pools = new Map<string, number[]>();
  lines.forEach((_, index) => {
    const deal = dealByLine[index];
    if (!deal || (deal.two == null && deal.three == null)) return;
    const list = pools.get(deal.poolKey) ?? [];
    list.push(index);
    pools.set(deal.poolKey, list);
  });

  if (pools.size === 0) return lines;

  const next = lines.map((line) => ({ ...line }));

  for (const indices of pools.values()) {
    const two = minPrice(indices.map((i) => dealByLine[i]?.two));
    const three = minPrice(indices.map((i) => dealByLine[i]?.three));
    const threeUnit = three != null ? packUnitPrice(three, 3) : null;
    const twoUnit = two != null ? packUnitPrice(two, 2) : null;

    let totalQty = indices.reduce((sum, i) => sum + next[i]!.quantity, 0);
    let threeLeft = threeUnit != null ? Math.floor(totalQty / 3) * 3 : 0;
    totalQty -= threeLeft;
    let twoLeft = twoUnit != null ? Math.floor(totalQty / 2) * 2 : 0;

    if (threeLeft <= 0 && twoLeft <= 0) continue;

    for (const index of indices) {
      const line = next[index]!;
      let remaining = line.quantity;
      let discountedQty = 0;
      let discountedValue = 0;

      if (threeUnit != null && threeLeft > 0 && remaining > 0 && line.unitPrice > threeUnit) {
        const take = Math.min(remaining, threeLeft);
        discountedQty += take;
        discountedValue += take * threeUnit;
        remaining -= take;
        threeLeft -= take;
      }

      if (twoUnit != null && twoLeft > 0 && remaining > 0 && line.unitPrice > twoUnit) {
        const take = Math.min(remaining, twoLeft);
        discountedQty += take;
        discountedValue += take * twoUnit;
        remaining -= take;
        twoLeft -= take;
      }

      if (discountedQty <= 0) continue;

      const fullQty = line.quantity - discountedQty;
      const blended = (discountedValue + fullQty * line.unitPrice) / line.quantity;
      next[index] = {
        ...line,
        unitPrice: round2(blended),
        compareAtPrice: line.compareAtPrice ?? line.unitPrice,
      };
    }
  }

  return next;
}

export function buildCartLine(
  product: Product,
  size: string,
  quantity: number,
  unitPrice: number,
  compareAtPrice: number | null,
): CartLine {
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    unitPrice,
    compareAtPrice,
    image: product.images[0],
    hoverImage: productHoverImage(product.images),
    size,
    colorway: product.colorway,
    quantity,
  };
}
