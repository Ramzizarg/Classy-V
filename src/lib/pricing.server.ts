import { isJogger } from "@/lib/facebookCatalog";
import { applyJoggerDuoPricing } from "@/lib/joggerDuo";
import { getProductById, isComingSoon, productHoverImage } from "@/lib/products";
import { getCatalog } from "@/lib/storefrontCatalog";
import type { CartLine } from "@/lib/types";

export type PricedCart =
  | { ok: true; lines: CartLine[]; subtotal: number }
  | { ok: false; error: string; status: number };

/**
 * Rebuild cart lines from the live catalog so a tampered client cannot set its
 * own prices, and stock is checked at the moment of use.
 */
export async function priceCart(requested: CartLine[]): Promise<PricedCart> {
  const catalog = await getCatalog();
  const lines: CartLine[] = [];
  const joggerByLine: boolean[] = [];

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
    const quantity = Math.max(1, Math.min(10, Math.trunc(line.quantity)));
    if (!sizeEntry || sizeEntry.stock < quantity) {
      return {
        ok: false,
        error: `${product.name} in size ${line.size} is no longer available.`,
        status: 409,
      };
    }

    const unitPrice =
      product.salePrice && product.salePrice < product.price ? product.salePrice : product.price;

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
    joggerByLine.push(isJogger(product));
  }

  const pricedLines = applyJoggerDuoPricing(lines, joggerByLine);
  const subtotal = pricedLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  return { ok: true, lines: pricedLines, subtotal };
}
