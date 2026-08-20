"use client";

import Image from "next/image";
import Link from "next/link";
import { BagGlyph, CloseGlyph } from "@/components/SocialGlyphs";
import { useStore } from "@/components/StoreProvider";
import { cartCount, shippingCost } from "@/lib/cart";
import { formatPrice } from "@/lib/format";

export function CartDrawer() {
  const { cartOpen, closeCart, lines, subtotal, shippingRate, setQuantity, removeLine } = useStore();

  if (!cartOpen) return null;

  const shipping = shippingCost(subtotal, shippingRate);
  const items = cartCount(lines);

  return (
    <div className="fixed inset-0 z-[210]" role="dialog" aria-modal aria-label="Cart">
      <button
        type="button"
        aria-label="Close cart"
        onClick={closeCart}
        className="absolute inset-0 bg-black/80"
      />

      {/* `max-w-sm` already caps the desktop width, so the percentage only narrows phones. */}
      <aside className="camo-surface overlay-panel absolute inset-y-0 right-0 flex w-[76%] max-w-sm flex-col border-l border-line">
        <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5">
          <span className="ui font-bold">Your cart</span>
          <div className="flex items-center gap-3">
            {lines.length > 0 ? <span className="ui text-muted">{items} items</span> : null}
            <button
              type="button"
              onClick={closeCart}
              aria-label="Close cart"
              className="-m-1 p-1 hover:opacity-70"
            >
              <CloseGlyph className="h-4 w-4" />
            </button>
          </div>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 pb-12 text-center">
            <BagGlyph className="h-9 w-9 text-muted" />
            <div>
              <p className="ui font-bold">Your cart is empty</p>
              <p className="ui-sm mt-2 text-muted">Nothing picked yet</p>
            </div>
            <Link
              href="/collection"
              onClick={closeCart}
              className="btn btn--solid w-full max-w-[220px]"
            >
              Shop all products
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              {lines.map((line) => (
                <article
                  key={`${line.productId}-${line.size}`}
                  className="flex gap-3 border-b border-line px-3 py-3"
                >
                  <Link
                    href={`/collection/${line.slug}`}
                    onClick={closeCart}
                    className="media-frame h-26 w-20 shrink-0 border border-line sm:h-36 sm:w-28"
                  >
                    <Image
                      src={line.image}
                      alt={line.name}
                      width={240}
                      height={300}
                      className="h-full w-full object-contain p-1"
                    />
                  </Link>

                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/collection/${line.slug}`}
                        onClick={closeCart}
                        className="ui hover-underline"
                      >
                        {line.name}
                      </Link>
                      <span className="shrink-0 text-[15px] font-bold tabular-nums sm:text-base">
                        {formatPrice(line.unitPrice)}
                      </span>
                    </div>

                    <p className="ui-sm mt-1 text-muted">Size {line.size}</p>

                    <div className="mt-auto flex items-center justify-between gap-2">
                      <div className="flex items-center border border-line">
                        <button
                          type="button"
                          onClick={() => setQuantity(line, line.quantity - 1)}
                          aria-label="Decrease quantity"
                          className="ui flex h-7 w-7 items-center justify-center hover:bg-surface"
                        >
                          −
                        </button>
                        <span className="ui flex h-7 w-8 items-center justify-center border-x border-line tabular-nums">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(line, line.quantity + 1)}
                          aria-label="Increase quantity"
                          className="ui flex h-7 w-7 items-center justify-center hover:bg-surface"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeLine(line)}
                        aria-label={`Remove ${line.name}`}
                        className="-m-1 p-1 text-muted hover:text-foreground"
                      >
                        <CloseGlyph className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="border-t border-line px-3 py-3">
              <div className="ui flex justify-between">
                <span>Subtotal</span>
                <span className="text-[13px] font-bold tabular-nums">{formatPrice(subtotal)}</span>
              </div>
              <div className="ui mt-1.5 flex justify-between text-muted">
                <span>Shipping</span>
                <span className="text-[13px] font-bold tabular-nums">
                  {shipping === 0 ? "Free" : formatPrice(shipping)}
                </span>
              </div>
              <div className="ui mt-2 flex items-baseline justify-between font-bold">
                <span>Total</span>
                <span className="text-[20px] tabular-nums">{formatPrice(subtotal + shipping)}</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link href="/cart" onClick={closeCart} className="btn">
                  View cart
                </Link>
                <Link href="/checkout" onClick={closeCart} className="btn btn--solid">
                  Checkout
                </Link>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
