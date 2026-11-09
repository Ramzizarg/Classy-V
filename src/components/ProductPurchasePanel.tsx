"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ProductBuyNowForm } from "@/components/ProductBuyNowForm";
import { ProductColourVariants } from "@/components/ProductColourVariants";
import { ProductCountdown } from "@/components/ProductCountdown";
import { SizeGuideModal } from "@/components/SizeGuideModal";
import { useStore } from "@/components/StoreProvider";
import { useFitProfile } from "@/components/useFitProfile";
import { formatPrice } from "@/lib/format";
import {
  JOGGER_DUO_PAIR_PRICE,
  buildCartLine,
  isJoggerDuoEligible,
  joggerDuoCompareAt,
  joggerDuoSavings,
  joggerDuoUnitPrice,
} from "@/lib/joggerDuo";
import { metaCatalogContentId, trackMeta } from "@/lib/metaPixel";
import { effectivePrice, isComingSoon, isSoldOut, productHoverImage } from "@/lib/products";
import { chartSupportsFinder, recommendSize, type SizeChart } from "@/lib/sizeCharts";
import type { CartLine, Product } from "@/lib/types";

type Pack = 1 | 2;

type DuoSlot = {
  productId: number;
  size: string;
};

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
  const colourOptions = useMemo(
    () => (variants.length >= 2 ? variants : [product]),
    [variants, product],
  );

  const available = product.sizes.filter((entry) => entry.stock > 0);
  const [size, setSize] = useState(available.length === 1 ? available[0].size : "");
  const [quantity, setQuantity] = useState(1);
  const [pack, setPack] = useState<Pack>(1);
  const [slots, setSlots] = useState<DuoSlot[]>(() => defaultSlots(product, colourOptions, ""));
  const [guideOpen, setGuideOpen] = useState(false);
  const { profile } = useFitProfile();
  const finder = sizeChart ? chartSupportsFinder(sizeChart) : false;
  const yourSize = useMemo(() => {
    if (!sizeChart || !finder || !profile) return null;
    const recommended = recommendSize(sizeChart, profile)?.size;
    return product.sizes.find((entry) => entry.size.toUpperCase() === recommended?.toUpperCase())?.size ?? null;
  }, [sizeChart, finder, profile, product.sizes]);

  const duoEligible = isJoggerDuoEligible(product);
  const duoMode = duoEligible && pack === 2;
  const duoPreviewOther =
    colourOptions.find((entry) => entry.id !== product.id) ?? product;
  const packOneImage = product.images[0];
  const packTwoImages = [product.images[0], duoPreviewOther.images[0]].filter(Boolean) as string[];

  const selectSize = (next: string) => {
    setSize(next);
    setQuantity(1);
  };

  const setPackMode = (next: Pack) => {
    setPack(next);
    if (next === 2) {
      setSlots(defaultSlots(product, colourOptions, size));
    }
  };

  const updateSlot = (index: 0 | 1, patch: Partial<DuoSlot>) => {
    setSlots((current) =>
      current.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot)),
    );
  };

  useEffect(() => {
    const contentId = metaCatalogContentId(product);
    if (!contentId) return;
    const viewedPrice = effectivePrice(product);
    trackMeta("ViewContent", {
      content_ids: [contentId],
      content_name: product.name,
      content_type: "product",
      content_category: product.categorySlug,
      contents: [{ id: contentId, quantity: 1, item_price: viewedPrice }],
      value: viewedPrice,
    });
  }, [product.id, product.slug, product.name, product.categorySlug, product.price, product.salePrice]);

  const comingSoon = isComingSoon(product);
  const soldOut = !comingSoon && isSoldOut(product);
  const price = effectivePrice(product);
  const onSale = price < product.price;
  const saved = hydrated && wishlist.includes(product.id);
  const selectedStock = product.sizes.find((entry) => entry.size === size)?.stock ?? 0;
  const locked = comingSoon || soldOut;

  const duoUnit = joggerDuoUnitPrice();
  const duoCompare = joggerDuoCompareAt(price);
  const duoSave = joggerDuoSavings(price);

  const productById = (id: number) => colourOptions.find((entry) => entry.id === id) ?? product;

  const stockFor = (candidate: Product, sizeValue: string) =>
    candidate.sizes.find((entry) => entry.size === sizeValue)?.stock ?? 0;

  const orderLines = useMemo((): CartLine[] | null => {
    if (locked) return null;

    if (duoMode) {
      if (!slots[0]?.size || !slots[1]?.size) return null;

      const first = productById(slots[0].productId);
      const second = productById(slots[1].productId);
      if (stockFor(first, slots[0].size) < 1 || stockFor(second, slots[1].size) < 1) return null;

      const sameSku = first.id === second.id && slots[0].size === slots[1].size;
      if (sameSku && stockFor(first, slots[0].size) < 2) return null;

      const compareAt = price < product.price ? product.price : price;
      if (sameSku) {
        return [buildCartLine(first, slots[0].size, 2, duoUnit, compareAt)];
      }
      return [
        buildCartLine(first, slots[0].size, 1, duoUnit, compareAt),
        buildCartLine(second, slots[1].size, 1, duoUnit, compareAt),
      ];
    }

    if (!size) return null;
    return [
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        unitPrice: price,
        compareAtPrice: onSale ? product.price : null,
        image: product.images[0],
        hoverImage: productHoverImage(product.images),
        size,
        colorway: product.colorway,
        quantity,
      },
    ];
    // colourOptions / slots are the live selectors; productById closes over them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    locked,
    duoMode,
    slots,
    colourOptions,
    size,
    quantity,
    price,
    onSale,
    product,
    duoUnit,
  ]);

  const addToCart = () => {
    if (!orderLines) return;
    orderLines.forEach((line, index) => {
      addLine(line, { openCart: index === orderLines.length - 1 });
    });
  };

  const actionReady = Boolean(orderLines);

  return (
    <div>
      <h1 className="product-title text-center font-black lg:text-left">
        {product.name}
      </h1>

      {comingSoon ? (
        <div className="product-coming-soon mt-3 text-center lg:text-left">
          <p className="product-coming-soon__label">Coming soon</p>
          <ProductCountdown endsAt={product.releaseAt} variant="panel" />
          {product.releaseAt ? (
            <p className="product-coming-soon__hint ui-sm mt-2" suppressHydrationWarning>
              Drops{" "}
              {new Date(product.releaseAt).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : null}
        </div>
      ) : duoMode ? (
        <p className="product-price mt-2 text-center lg:text-right">
          <span className="text-muted line-through">{formatPrice(duoCompare)}</span>{" "}
          <span className="product-price__current">{formatPrice(JOGGER_DUO_PAIR_PRICE)}</span>
          <span className="product-price__pack ui-sm text-muted"> · 2 joggers</span>
        </p>
      ) : (
        <p className="product-price mt-2 text-center lg:text-right">
          {onSale ? (
            <>
              <span className="text-muted line-through">{formatPrice(product.price)}</span>{" "}
              <span className="product-price__current">{formatPrice(price)}</span>
            </>
          ) : (
            <span className="product-price__current">{formatPrice(price)}</span>
          )}
          {soldOut ? <span className="font-bold text-[color:#e11d2e]"> — Sold Out</span> : null}
        </p>
      )}

      {duoEligible && !comingSoon && !soldOut ? (
        <div className="pack-toggle mt-4" role="radiogroup" aria-label="Choose pack">
          <button
            type="button"
            role="radio"
            aria-checked={pack === 1}
            className={`pack-toggle__btn${pack === 1 ? " pack-toggle__btn--active" : ""}`}
            onClick={() => setPackMode(1)}
          >
            <span className="pack-toggle__radio" aria-hidden />
            {packOneImage ? (
              <span className="pack-toggle__media pack-toggle__media--one" aria-hidden>
                <span className="pack-toggle__thumb">
                  <Image src={packOneImage} alt="" fill sizes="64px" className="pack-toggle__photo object-contain" />
                </span>
              </span>
            ) : null}
            <span className="pack-toggle__copy">
              <span className="pack-toggle__label">1 jogger</span>
              <span className="pack-toggle__sub">Standard price</span>
            </span>
            <span className="pack-toggle__prices">
              <span className="pack-toggle__price tabular-nums">{formatPrice(price)}</span>
              {onSale ? (
                <span className="pack-toggle__was tabular-nums">{formatPrice(product.price)}</span>
              ) : null}
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={pack === 2}
            className={`pack-toggle__btn pack-toggle__btn--deal${pack === 2 ? " pack-toggle__btn--active" : ""}`}
            onClick={() => setPackMode(2)}
          >
            <span className="pack-toggle__tag">Best deal</span>
            <span className="pack-toggle__radio" aria-hidden />
            {packTwoImages.length > 0 ? (
              <span className="pack-toggle__media pack-toggle__media--two" aria-hidden>
                {packTwoImages.map((src, index) => (
                  <span key={`${src}-${index}`} className="pack-toggle__thumb">
                    <Image src={src} alt="" fill sizes="56px" className="pack-toggle__photo object-contain" />
                  </span>
                ))}
              </span>
            ) : null}
            <span className="pack-toggle__copy">
              <span className="pack-toggle__label">2 joggers</span>
              {duoSave > 0 ? (
                <span className="pack-toggle__save">Save {formatPrice(duoSave)}</span>
              ) : (
                <span className="pack-toggle__sub">Mix colours & sizes</span>
              )}
            </span>
            <span className="pack-toggle__prices">
              <span className="pack-toggle__price tabular-nums">{formatPrice(JOGGER_DUO_PAIR_PRICE)}</span>
              <span className="pack-toggle__was tabular-nums">{formatPrice(duoCompare)}</span>
            </span>
          </button>
        </div>
      ) : null}

      {!duoMode ? <ProductColourVariants variants={variants} activeId={product.id} /> : null}

      {duoMode ? (
        <div className={`mt-5${comingSoon ? " pointer-events-none opacity-40" : ""}`}>
          <div className="flex items-baseline justify-center gap-3 lg:justify-between lg:gap-0">
            <p className="ui-sm text-muted">Pick colour & size for each</p>
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

          <div className="duo-slots mt-3 space-y-4">
            {([0, 1] as const).map((index) => {
              const slot = slots[index]!;
              const slotProduct = productById(slot.productId);
              return (
                <div key={index} className="duo-slot">
                  <p className="ui-sm font-bold">Jogger {index + 1}</p>

                  {colourOptions.length > 1 ? (
                    <div className="mt-2 flex flex-wrap justify-center gap-1.5 lg:justify-start">
                      {colourOptions.map((option) => {
                        const current = option.id === slot.productId;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-label={option.colorway || option.name}
                            aria-pressed={current}
                            onClick={() => updateSlot(index, { productId: option.id, size: "" })}
                            className={`media-frame product-colour-variants__thumb h-16 w-16 border transition-colors lg:h-20 lg:w-20 ${
                              current ? "border-price" : "border-line hover:border-foreground"
                            }`}
                          >
                            <Image
                              src={option.images[0]}
                              alt={option.name}
                              fill
                              sizes="80px"
                              className="product-colour-variants__img h-full w-full object-contain p-1"
                            />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="ui-sm mt-1 text-center text-muted lg:text-left">{slotProduct.colorway}</p>
                  )}

                  <div className="mt-2 flex flex-wrap justify-center gap-1.5 lg:justify-start">
                    {slotProduct.sizes.map((entry) => {
                      const other = slots[index === 0 ? 1 : 0]!;
                      const sameAsOther =
                        other.productId === slotProduct.id && other.size === entry.size;
                      const disabled = entry.stock === 0 || (sameAsOther && entry.stock < 2);
                      const recommended = yourSize === entry.size;
                      return (
                        <button
                          key={entry.size}
                          type="button"
                          disabled={disabled}
                          onClick={() => updateSlot(index, { size: entry.size })}
                          aria-label={recommended ? `${entry.size}, your recommended size` : undefined}
                          className={`ui relative min-w-11 border px-3 py-2 transition-colors lg:min-w-14 lg:py-3 ${
                            slot.size === entry.size
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
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={`mt-5${comingSoon ? " pointer-events-none opacity-40" : ""}`}>
          <div className="flex items-baseline justify-center gap-3 lg:justify-between lg:gap-0">
            <p className="ui-sm hidden text-muted lg:block">Size</p>
            {sizeChart && !comingSoon ? (
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

          <div className="mt-2 flex flex-wrap justify-center gap-1.5 lg:justify-start">
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
      )}

      {comingSoon ? (
        <div className="purchase-actions mx-auto mt-4 lg:mx-0">
          <button type="button" disabled className="btn btn--coming-soon w-full">
            Coming soon
          </button>
        </div>
      ) : soldOut ? (
        <div className="purchase-actions mx-auto mt-4 lg:mx-0">
          <button type="button" disabled className="btn btn--sold-out w-full">
            Sold out
          </button>
        </div>
      ) : null}

      {orderLines ? (
        <div id="product-buy-now">
          <ProductBuyNowForm
            key={orderLines.map((line) => `${line.productId}-${line.size}`).join("|")}
            lines={orderLines}
            shippingRate={shippingRate}
            afterPlaceOrder={
              <div className="flex items-stretch gap-2">
                {!duoMode ? (
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
                        setQuantity((value) =>
                          selectedStock ? Math.min(selectedStock, value + 1) : value + 1,
                        )
                      }
                      aria-label="Increase quantity"
                      className="ui h-10 w-8"
                    >
                      +
                    </button>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={addToCart}
                  className="btn btn--solid min-w-[150px] flex-1"
                >
                  Add to cart
                </button>
              </div>
            }
          />
        </div>
      ) : null}

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
          onSelectSize={(next) => {
            if (duoMode) {
              setSlots((current) => current.map((slot) => ({ ...slot, size: next })));
            } else {
              selectSize(next);
            }
          }}
          onClose={() => setGuideOpen(false)}
        />
      ) : null}
    </div>
  );
}

function defaultSlots(product: Product, colourOptions: Product[], seedSize: string): DuoSlot[] {
  const other = colourOptions.find((entry) => entry.id !== product.id) ?? product;
  return [
    { productId: product.id, size: seedSize },
    { productId: other.id, size: "" },
  ];
}

function RulerGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-guide-link__icon" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2.5" y="7.5" width="19" height="9" rx="1" />
      <path d="M6.5 7.5v3M10 7.5v4.5M13.5 7.5v3M17 7.5v4.5" />
    </svg>
  );
}
