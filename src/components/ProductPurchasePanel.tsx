"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductColourVariants } from "@/components/ProductColourVariants";
import { SizeGuideModal } from "@/components/SizeGuideModal";
import { useStore } from "@/components/StoreProvider";
import { useFitProfile } from "@/components/useFitProfile";
import { formatPrice } from "@/lib/format";
import { effectivePrice, isSoldOut } from "@/lib/products";
import { chartSupportsFinder, recommendSize, type SizeChart } from "@/lib/sizeCharts";
import type { Product } from "@/lib/types";

export function ProductPurchasePanel({
  product,
  variants = [],
  sizeChart = null,
}: {
  product: Product;
  variants?: Product[];
  sizeChart?: SizeChart | null;
}) {
  const { addLine, toggleWishlist, wishlist, hydrated, shippingRate } = useStore();
  const available = product.sizes.filter((entry) => entry.stock > 0);
  const [size, setSize] = useState(available.length === 1 ? available[0].size : "");
  const [quantity, setQuantity] = useState(1);
  const [guideOpen, setGuideOpen] = useState(false);
  const { profile } = useFitProfile();
  const finder = sizeChart ? chartSupportsFinder(sizeChart) : false;
  const yourSize = useMemo(() => {
    if (!sizeChart || !finder || !profile) return null;
    const recommended = recommendSize(sizeChart, profile)?.size;
    return product.sizes.find((entry) => entry.size.toUpperCase() === recommended?.toUpperCase())?.size ?? null;
  }, [sizeChart, finder, profile, product.sizes]);

  const router = useRouter();
  const [buying, setBuying] = useState(false);
  const [needSize, setNeedSize] = useState(false);
  const [nudge, setNudge] = useState(false);

  const selectSize = (next: string) => {
    setSize(next);
    setQuantity(1);
    setNeedSize(false);
  };

  const soldOut = isSoldOut(product);
  const price = effectivePrice(product);
  const onSale = price < product.price;
  const saved = hydrated && wishlist.includes(product.id);
  const selectedStock = product.sizes.find((entry) => entry.size === size)?.stock ?? 0;

  useEffect(() => {
    if (!soldOut) router.prefetch("/checkout");
  }, [router, soldOut]);

  const line = () => ({
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

  const add = () => {
    if (soldOut || !size) return;
    /* No toast: `addLine` slides the cart open, which is the confirmation. */
    addLine(line());
  };

  const buyNow = () => {
    if (soldOut || buying) return;
    if (!size) {
      setNeedSize(true);
      setNudge(true);
      return;
    }
    setBuying(true);
    addLine(line(), { openCart: false });
    router.push("/checkout");
  };

  return (
    <div>
      <h1 className="product-title text-center font-black lg:text-left">
        {product.name}
      </h1>

      <p className="product-price mt-2 text-center lg:text-right">
        {onSale ? (
          <>
            <span className="text-muted line-through">{formatPrice(product.price)}</span>{" "}
            <span className="product-price__current">{formatPrice(price)}</span>
          </>
        ) : (
          <span className="product-price__current">{formatPrice(price)}</span>
        )}
        {soldOut ? <span className="font-bold text-foreground"> — Sold Out</span> : null}
      </p>

      <ProductColourVariants variants={variants} activeId={product.id} />

      <div className="mt-5">
        <div className="flex items-baseline justify-center gap-3 lg:justify-between lg:gap-0">
          <p className="ui-sm hidden text-muted lg:block">Size</p>
          {sizeChart ? (
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="ui-sm hover-underline size-guide-link"
            >
              <RulerGlyph />
              {finder ? "Find my size" : "Size guide"}
            </button>
          ) : null}
        </div>

        <div
          className={`mt-2 flex flex-wrap justify-center gap-1.5 lg:justify-start ${nudge ? "size-grid--nudge" : ""} ${
            needSize ? "size-grid--need" : ""
          }`}
          onAnimationEnd={() => setNudge(false)}
        >
          {product.sizes.map((entry) => {
            const disabled = entry.stock === 0;
            const recommended = yourSize === entry.size;
            return (
              <button
                key={entry.size}
                type="button"
                disabled={disabled}
                onClick={() => selectSize(entry.size)}
                aria-label={recommended ? `${entry.size}, your recommended size` : undefined}
                className={`ui relative min-w-11 border px-3 py-2 transition-colors lg:min-w-16 lg:py-5 ${
                  size === entry.size
                    ? "border-selected bg-selected text-white"
                    : "border-foreground hover:bg-foreground hover:text-background"
                } ${disabled ? "size-sold-out cursor-not-allowed border-line text-muted hover:bg-transparent hover:text-muted" : ""}`}
              >
                {entry.size}
                {recommended ? <span className="size-btn__dot" aria-hidden /> : null}
              </button>
            );
          })}
        </div>

        {yourSize ? (
          <p className="ui-sm mt-2 text-center text-muted lg:text-left">
            <span className="size-btn__dot size-btn__dot--inline" aria-hidden /> Your size: {yourSize}
            {size !== yourSize ? (
              <>
                {" · "}
                <button type="button" className="hover-underline text-foreground" onClick={() => selectSize(yourSize)}>
                  Select
                </button>
              </>
            ) : null}
            {" · "}
            <button type="button" className="hover-underline" onClick={() => setGuideOpen(true)}>
              Edit
            </button>
          </p>
        ) : null}

        {size && selectedStock > 0 && selectedStock <= 5 ? (
          <p className="ui-sm mt-2 text-center lg:text-left">Low stock — {selectedStock} left</p>
        ) : null}
      </div>

      <div className="purchase-actions mx-auto mt-4 lg:mx-0">
        <div className="flex items-stretch gap-2">
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
            className={`btn min-w-[150px] flex-1 ${soldOut ? "btn--sold-out" : "btn--solid"}`}
          >
            {soldOut ? "Sold out" : size ? "Add to cart" : "Select a size"}
          </button>
        </div>

        {!soldOut ? (
          <>
            <button
              type="button"
              onClick={buyNow}
              disabled={buying}
              aria-describedby={needSize ? "buy-now-hint" : undefined}
              className="btn btn--buy mt-2 w-full"
            >
              <BoltGlyph />
              <span>{buying ? "Going to checkout…" : "Buy now"}</span>
              {size && !buying ? (
                <span className="btn--buy__total tabular-nums">{formatPrice(price * quantity)}</span>
              ) : null}
            </button>
            <p
              id="buy-now-hint"
              role="status"
              className={`ui-sm mt-1.5 text-center lg:text-left ${needSize ? "text-selected" : "text-muted"}`}
            >
              {needSize ? "Pick a size first" : "Skip the cart — straight to checkout"}
            </p>
          </>
        ) : null}
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

      {guideOpen && sizeChart ? (
        <SizeGuideModal
          chart={sizeChart}
          productSizes={product.sizes}
          onSelectSize={selectSize}
          onClose={() => setGuideOpen(false)}
        />
      ) : null}
    </div>
  );
}

function BoltGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="btn--buy__icon" fill="currentColor">
      <path d="M13.2 2 4.5 13.6h6.1L9.9 22l8.6-11.7h-6.1L13.2 2Z" />
    </svg>
  );
}

function RulerGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-guide-link__icon" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2.5" y="7.5" width="19" height="9" rx="1" />
      <path d="M6.5 7.5v3M10 7.5v4.5M13.5 7.5v3M17 7.5v4.5" />
    </svg>
  );
}
