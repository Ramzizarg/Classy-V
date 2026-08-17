import { getProductById } from "@/lib/products";
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

  for (const line of requested) {
    const product = getProductById(line.productId, catalog);
    if (!product) {
      return { ok: false, error: "Unknown product in bag.", status: 400 };
    }

    const sizeEntry = product.sizes.find((entry) => entry.size === line.size);
    if (!sizeEntry || sizeEntry.stock === 0) {
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
      size: line.size,
      colorway: product.colorway,
      quantity: Math.max(1, Math.min(10, Math.trunc(line.quantity))),
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  return { ok: true, lines, subtotal };
}
