import { isJogger } from "@/lib/facebookCatalog";
import { effectivePrice, isComingSoon, isSoldOut, productHoverImage } from "@/lib/products";
import type { CartLine, Product } from "@/lib/types";

/** Fixed checkout total for any complete pair of joggers (2 × sale 65 → 120). */
export const JOGGER_DUO_PAIR_PRICE = 120;

export function isJoggerDuoEligible(product: Product): boolean {
  return isJogger(product) && !isComingSoon(product) && !isSoldOut(product);
}

export function joggerDuoUnitPrice(): number {
  return JOGGER_DUO_PAIR_PRICE / 2;
}

export function joggerDuoCompareAt(unitPrice: number): number {
  return unitPrice * 2;
}

export function joggerDuoSavings(unitPrice: number): number {
  return Math.max(0, joggerDuoCompareAt(unitPrice) - JOGGER_DUO_PAIR_PRICE);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Drop every complete pair of jogger units to the duo deal (120 DT / 2).
 * Leftover odd units keep their catalog sale price.
 */
export function applyJoggerDuoPricing(
  lines: CartLine[],
  joggerByLine: boolean[],
): CartLine[] {
  const joggerQty = lines.reduce(
    (sum, line, index) => sum + (joggerByLine[index] ? line.quantity : 0),
    0,
  );
  let discountedLeft = Math.floor(joggerQty / 2) * 2;
  if (discountedLeft <= 0) return lines;

  const duoUnit = joggerDuoUnitPrice();

  return lines.map((line, index) => {
    if (!joggerByLine[index] || discountedLeft <= 0 || line.unitPrice <= duoUnit) {
      return line;
    }

    const discountedQty = Math.min(line.quantity, discountedLeft);
    discountedLeft -= discountedQty;
    const fullQty = line.quantity - discountedQty;
    const blended = (discountedQty * duoUnit + fullQty * line.unitPrice) / line.quantity;

    return {
      ...line,
      unitPrice: round2(blended),
      compareAtPrice: line.compareAtPrice ?? line.unitPrice,
    };
  });
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
