"use client";

import { useState } from "react";
import { ProductColourVariants } from "@/components/ProductColourVariants";
import { SizeGuideModal } from "@/components/SizeGuideModal";
import { useStore } from "@/components/StoreProvider";
import { formatPrice } from "@/lib/format";
import { effectivePrice, isSoldOut } from "@/lib/products";
import type { Product } from "@/lib/types";

export function ProductPurchasePanel({
  product,
  variants = [],
}: {
  product: Product;
  variants?: Product[];
}) {
  const { addLine, toggleWishlist, wishlist, hydrated, shippingRate } = useStore();
  const available = product.sizes.filter((entry) => entry.stock > 0);
  const [size, setSize] = useState(available.length === 1 ? available[0].size : "");
  const [quantity, setQuantity] = useState(1);
  const [guideOpen, setGuideOpen] = useState(false);

  const soldOut = isSoldOut(product);
  const price = effectivePrice(product);
  const onSale = price < product.price;
  const saved = hydrated && wishlist.includes(product.id);
  const selectedStock = product.sizes.find((entry) => entry.size === size)?.stock ?? 0;

  const add = () => {
    if (soldOut || !size) return;
    addLine({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      unitPrice: price,
      compareAtPrice: onSale ? product.price : null,
      image: product.images[0],
      size,
      colorway: product.colorway,
      quantity,
    });
    /* No toast: `addLine` slides the cart open, which is the confirmation. */
  };

  return (
    <div>
      <h1 className="product-title text-center font-bold lg:text-left">
        {product.name}
      </h1>

      <p className="product-price mt-2 text-center text-price lg:text-left">
        {onSale ? (
          <>
            <span className="text-muted line-through">{formatPrice(product.price)}</span>{" "}
            <span>{formatPrice(price)}</span>
          </>
        ) : (
          formatPrice(price)
        )}
        {soldOut ? <span className="font-bold text-foreground"> — Sold Out</span> : null}
      </p>

      <ProductColourVariants variants={variants} activeId={product.id} />

      <div className="mt-5">
        <div className="flex items-baseline justify-center gap-3 lg:justify-between lg:gap-0">
          <p className="ui-sm text-muted">Size</p>
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="ui-sm hover-underline text-muted"
          >
            Size guide
          </button>
        </div>

        <div className="mt-2 flex flex-wrap justify-center gap-1.5 lg:justify-start">
          {product.sizes.map((entry) => {
            const disabled = entry.stock === 0;
            return (
              <button
                key={entry.size}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setSize(entry.size);
                  setQuantity(1);
                }}
                className={`ui min-w-11 border px-3 py-2 transition-colors lg:min-w-16 lg:py-5 ${
                  size === entry.size
                    ? "border-selected bg-selected text-white"
                    : "border-foreground hover:bg-foreground hover:text-black"
                } ${disabled ? "size-sold-out cursor-not-allowed border-line text-muted hover:bg-transparent hover:text-muted" : ""}`}
              >
                {entry.size}
              </button>
            );
          })}
        </div>

        {size && selectedStock > 0 && selectedStock <= 5 ? (
          <p className="ui-sm mt-2 text-center lg:text-left">Low stock — {selectedStock} left</p>
        ) : null}
      </div>

      <div className="mt-4 flex items-stretch justify-center gap-2 lg:justify-start">
        <div className="flex items-center border border-line">
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            aria-label="Decrease quantity"
            className="ui h-10 w-8"
          >
            −
          </button>
          <span className="ui w-7 text-center tabular-nums">{quantity}</span>
          <button
            type="button"
            onClick={() =>
              setQuantity((value) => (selectedStock ? Math.min(selectedStock, value + 1) : value + 1))
            }
            aria-label="Increase quantity"
            className="ui h-10 w-8"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={add}
          disabled={soldOut || !size}
          className="btn btn--solid min-w-[150px]"
        >
          {soldOut ? "Sold out" : size ? "Add to cart" : "Select a size"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => toggleWishlist(product.id)}
        className="ui-sm hover-underline mt-3 block w-full text-center text-muted lg:w-auto lg:text-left"
      >
        {saved ? "Remove from wishlist" : "Save to wishlist"}
      </button>

      <p className="ui-sm mt-5 text-center leading-relaxed text-muted lg:text-left">
        Delivery {formatPrice(shippingRate)} · Dispatched within 48h · 30 day returns
      </p>

      {guideOpen ? <SizeGuideModal onClose={() => setGuideOpen(false)} /> : null}
    </div>
  );
}
