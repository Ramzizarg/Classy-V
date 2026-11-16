/**
 * @deprecated Prefer `@/lib/packDeals`. Thin wrappers keep older imports compiling.
 */
import { isJogger } from "@/lib/facebookCatalog";
import {
  LEGACY_JOGGER_DUO_PRICE,
  applyPackPricing,
  buildCartLine,
  isPackDealEligible,
  packCompareAt,
  packSavings,
  packUnitPrice,
  resolvePackDeal,
  type ResolvedPackDeal,
} from "@/lib/packDeals";
import type { CartLine, Product } from "@/lib/types";

export const JOGGER_DUO_PAIR_PRICE = LEGACY_JOGGER_DUO_PRICE;
export { buildCartLine };

export function isJoggerDuoEligible(product: Product): boolean {
  return isPackDealEligible(product) && isJogger(product);
}

export function joggerDuoUnitPrice(): number {
  return packUnitPrice(LEGACY_JOGGER_DUO_PRICE, 2);
}

export function joggerDuoCompareAt(unitPrice: number): number {
  return packCompareAt(unitPrice, 2);
}

export function joggerDuoSavings(unitPrice: number): number {
  return packSavings(unitPrice, LEGACY_JOGGER_DUO_PRICE, 2);
}

/** @deprecated Use applyPackPricing with resolvePackDeal per line. */
export function applyJoggerDuoPricing(lines: CartLine[], joggerByLine: boolean[]): CartLine[] {
  const dealByLine: Array<ResolvedPackDeal | null> = joggerByLine.map((isDuo) =>
    isDuo
      ? {
          unitLabel: "jogger",
          two: LEGACY_JOGGER_DUO_PRICE,
          three: null,
          poolKey: "legacy:joggers",
        }
      : null,
  );
  return applyPackPricing(lines, dealByLine);
}

export { resolvePackDeal };
