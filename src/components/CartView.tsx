"use client";

import Image from "next/image";
import Link from "next/link";
import { useStore } from "@/components/StoreProvider";
import { shippingCost } from "@/lib/cart";
import { formatPrice } from "@/lib/format";

export function CartView() {
  const { lines, subtotal, shippingRate, setQuantity, removeLine, clearCart, hydrated } = useStore();

  if (!hydrated) {
    return <div className="h-40" />;
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="ui">Your cart is empty</p>
        <Link href="/collection" className="btn btn--solid">
          Shop all products
        </Link>
      </div>
    );
  }

  const shipping = shippingCost(subtotal, shippingRate);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.7fr_1fr] lg:gap-12">
      <div>
        <div className="ui flex items-center justify-between border-b border-line pb-2 text-muted">
          <span>Product</span>
          <button type="button" onClick={clearCart} className="hover-underline">
            Empty cart
          </button>
        </div>

        {lines.map((line) => (
          <article
            key={`${line.productId}-${line.size}`}
            className="flex gap-3 border-b border-line py-3 sm:gap-4"
          >
            <Link
              href={`/collection/${line.slug}`}
              className="media-frame h-32 w-26 shrink-0 border border-line sm:h-40 sm:w-32"
            >
              <Image
                src={line.image}
                alt={line.name}
                width={320}
                height={400}
                className="h-full w-full object-contain p-1"
              />
            </Link>

            <div className="flex flex-1 flex-col">
              <Link href={`/collection/${line.slug}`} className="ui hover-underline">
                {line.name}
              </Link>
              <p className="ui mt-1 text-muted text-base">{line.size}</p>
              <p className="ui mt-1 text-yellow-400 text-lg font-bold">{formatPrice(line.unitPrice)} each</p>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                <div className="flex items-center border border-line">
                  <button
                    type="button"
                    onClick={() => setQuantity(line, line.quantity - 1)}
                    aria-label="Decrease quantity"
                    className="ui h-8 w-8"
                  >
                    −
                  </button>
                  <span className="ui w-8 text-center tabular-nums">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(line, line.quantity + 1)}
                    aria-label="Increase quantity"
                    className="ui h-8 w-8"
                  >
                    +
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <p className="ui tabular-nums text-yellow-400 text-lg font-bold">{formatPrice(line.unitPrice * line.quantity)}</p>
                  <button
                    type="button"
                    onClick={() => removeLine(line)}
                    className="ui-sm hover-underline text-muted"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}

        <Link href="/collection" className="ui hover-underline mt-4 inline-block">
          Continue shopping
        </Link>
      </div>

      <aside className="h-fit border border-line p-3 lg:sticky lg:top-24">
        <p className="section-title">Order summary</p>

        <div className="ui mt-3 flex justify-between">
          <span className="text-muted">Subtotal</span>
          <span className="tabular-nums">{formatPrice(subtotal)}</span>
        </div>
        <div className="ui mt-1.5 flex justify-between">
          <span className="text-muted">Shipping</span>
          <span className="tabular-nums">{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
        </div>
        <div className="ui mt-1.5 flex justify-between border-t border-line pt-2 font-bold">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(subtotal + shipping)}</span>
        </div>

        <Link href="/checkout" className="btn btn--solid mt-3 w-full">
          Checkout
        </Link>
      </aside>
    </div>
  );
}
