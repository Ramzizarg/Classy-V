import { SITE } from "@/lib/site";
import type { CartLine } from "@/lib/types";

export const CART_STORAGE_KEY = "classyv.cart.v1";
export const WISHLIST_STORAGE_KEY = "classyv.wishlist.v1";

export function cartLineKey(line: Pick<CartLine, "productId" | "size">): string {
  return `${line.productId}::${line.size}`;
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function shippingCost(
  subtotal: number,
  deliveryPrice: number = SITE.standardShipping,
): number {
  if (subtotal <= 0) return 0;
  return deliveryPrice;
}

export function cartTotal(
  lines: CartLine[],
  deliveryPrice: number = SITE.standardShipping,
): number {
  const subtotal = cartSubtotal(lines);
  return subtotal + shippingCost(subtotal, deliveryPrice);
}

export function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<CartLine>;
  return (
    typeof line.productId === "number" &&
    typeof line.slug === "string" &&
    typeof line.name === "string" &&
    typeof line.unitPrice === "number" &&
    typeof line.size === "string" &&
    typeof line.quantity === "number" &&
    line.quantity > 0
  );
}
