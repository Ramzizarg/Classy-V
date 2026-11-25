import { MAX_LINE_QUANTITY } from "@/lib/cart";
import { applyPackPricing, resolvePackDeal, type ResolvedPackDeal } from "@/lib/packDeals";
import { getProductById, isComingSoon, productHoverImage } from "@/lib/products";
import { isHoodieCategorySlug } from "@/lib/progressivePricing";
import { computeProgressiveStateFromDb } from "@/lib/progressivePricing.server";
import { getCatalog } from "@/lib/storefrontCatalog";
import type { CartLine } from "@/lib/types";

export type PricedCart =
  | { ok: true; lines: CartLine[]; subtotal: number; progressivePrice: number | null }
  | { ok: false; error: string; status: number };

/**
 * Rebuild cart lines from the live catalog so a tampered client cannot set its
 * own prices, and stock is checked at the moment of use.
 */
export async function priceCart(requested: CartLine[]): Promise<PricedCart> {
  const catalog = await getCatalog();
  const lines: CartLine[] = [];
  const dealByLine: Array<ResolvedPackDeal | null> = [];
  const needsProgressive = requested.some((line) => {
    const product = getProductById(line.productId, catalog);
    return product ? isHoodieCategorySlug(product.categorySlug) : false;
  });
  const progressive = needsProgressive ? await computeProgressiveStateFromDb() : null;
  const progressivePrice =
    progressive?.enabled === true ? progressive.currentPrice : null;

  for (const line of requested) {
    const product = getProductById(line.productId, catalog);
    if (!product) {
      return { ok: false, error: "Unknown product in bag.", status: 400 };
    }
    if (isComingSoon(product)) {
      return {
        ok: false,
        error: `"${product.name}" is coming soon and cannot be ordered yet.`,
        status: 409,
      };
    }

    const sizeEntry = product.sizes.find((entry) => entry.size === line.size);
    const quantity = Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.trunc(line.quantity)));
    if (!sizeEntry || sizeEntry.stock < 1) {
      return {
        ok: false,
        error: `${product.name} in size ${line.size} is no longer available.`,
        status: 409,
      };
    }
    if (sizeEntry.stock < quantity) {
      return {
        ok: false,
        error: `Only ${sizeEntry.stock} left of ${product.name} in size ${line.size}. Lower the quantity to continue.`,
        status: 409,
      };
    }

    const catalogUnit =
      product.salePrice && product.salePrice < product.price ? product.salePrice : product.price;
    const unitPrice =
      progressivePrice != null && isHoodieCategorySlug(product.categorySlug)
        ? progressivePrice
        : catalogUnit;

    lines.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      unitPrice,
      compareAtPrice: unitPrice < product.price ? product.price : null,
      image: product.images[0],
      hoverImage: productHoverImage(product.images),
      size: line.size,
      colorway: product.colorway,
      quantity,
    });
    dealByLine.push(resolvePackDeal(product));
  }

  const pricedLines = applyPackPricing(lines, dealByLine);
  const subtotal = pricedLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  return { ok: true, lines: pricedLines, subtotal, progressivePrice };
}
