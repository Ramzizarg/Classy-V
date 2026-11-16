"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ProductBuyNowForm } from "@/components/ProductBuyNowForm";
import { ProductColourVariants } from "@/components/ProductColourVariants";
import { ProductCountdown } from "@/components/ProductCountdown";
import { SizeGuideModal } from "@/components/SizeGuideModal";
import { useStore } from "@/components/StoreProvider";
import { useFitProfile } from "@/components/useFitProfile";
import { MAX_LINE_QUANTITY } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import {
  buildCartLine,
  isPackDealEligible,
  packCompareAt,
  packLabel,
  packSavings,
  packUnitPrice,
  resolvePackDeal,
} from "@/lib/packDeals";
import { metaCatalogContentId, trackMeta } from "@/lib/metaPixel";
import { effectivePrice, isComingSoon, isSoldOut, productHoverImage } from "@/lib/products";
import { sortSizeStocks } from "@/lib/productSizesDisplay";
import { chartSupportsFinder, recommendSize, type SizeChart } from "@/lib/sizeCharts";
import type { CartLine, Product } from "@/lib/types";

type PackQty = 1 | 2 | 3;

type PackSlot = {
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
  const router = useRouter();
  const { addLine, toggleWishlist, wishlist, hydrated, shippingRate } = useStore();
  const colourOptions = useMemo(
    () => (variants.length >= 2 ? variants : [product]),
    [variants, product],
  );

  const available = product.sizes.filter((entry) => entry.stock > 0);
  const [size, setSize] = useState(available.length === 1 ? available[0].size : "");
  const [quantity, setQuantity] = useState(1);
  const [pack, setPack] = useState<PackQty>(1);
  const [slots, setSlots] = useState<PackSlot[]>(() => defaultSlots(product, colourOptions, "", 2));
  const [guideOpen, setGuideOpen] = useState(false);
  const { profile } = useFitProfile();
  const finder = sizeChart ? chartSupportsFinder(sizeChart) : false;
  const yourSize = useMemo(() => {
    if (!sizeChart || !finder || !profile) return null;
    const recommended = recommendSize(sizeChart, profile)?.size;
    return product.sizes.find((entry) => entry.size.toUpperCase() === recommended?.toUpperCase())?.size ?? null;
  }, [sizeChart, finder, profile, product.sizes]);

  const deal = resolvePackDeal(product);
  const packEligible = isPackDealEligible(product);
  const packMode = packEligible && pack > 1;
  const packQty = packMode ? (pack as 2 | 3) : null;
  const packTotal = packQty === 2 ? deal?.two ?? null : packQty === 3 ? deal?.three ?? null : null;
  const unitLabel = deal?.unitLabel || "item";

  const packOneImage = product.images[0];
  const packPreviewImages = (count: 2 | 3) => {
    const images: string[] = [];
    for (let i = 0; i < count; i++) {
      const option = colourOptions[i % colourOptions.length] ?? product;
      const src = option.images[0];
      if (src) images.push(src);
    }
    return images;
  };

  const selectSize = (next: string) => {
    setSize(next);
    setQuantity(1);
  };

  const setPackMode = (next: PackQty) => {
    setPack(next);
    if (next === 2 || next === 3) {
      setSlots(defaultSlots(product, colourOptions, size, next));
    }
  };

  const updateSlot = (index: number, patch: Partial<PackSlot>) => {
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

  const productById = (id: number) => colourOptions.find((entry) => entry.id === id) ?? product;

  const stockFor = (candidate: Product, sizeValue: string) =>
    candidate.sizes.find((entry) => entry.size === sizeValue)?.stock ?? 0;

  const orderLines = useMemo((): CartLine[] | null => {
    if (locked) return null;

    if (packMode && packQty && packTotal != null && deal) {
      if (slots.length !== packQty || slots.some((slot) => !slot.size)) return null;

      const demand = new Map<string, { product: Product; size: string; count: number }>();
      for (const slot of slots) {
        const candidate = productById(slot.productId);
        const key = `${candidate.id}::${slot.size}`;
        const existing = demand.get(key);
        if (existing) existing.count += 1;
        else demand.set(key, { product: candidate, size: slot.size, count: 1 });
      }
      for (const entry of demand.values()) {
        if (stockFor(entry.product, entry.size) < entry.count) return null;
      }

      const unit = packUnitPrice(packTotal, packQty);
      const compareAt = price < product.price ? product.price : price;
      const lines: CartLine[] = [];
      for (const entry of demand.values()) {
        lines.push(buildCartLine(entry.product, entry.size, entry.count, unit, compareAt));
      }
      return lines;
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
    packMode,
    packQty,
    packTotal,
    deal,
    slots,
    colourOptions,
    size,
    quantity,
    price,
    onSale,
    product,
  ]);

  const sizesRef = useRef<HTMLDivElement>(null);
  const buyRef = useRef<HTMLDivElement>(null);
  const [attention, setAttention] = useState(false);
  const [added, setAdded] = useState(false);
  const [sizeSheetOpen, setSizeSheetOpen] = useState(false);
  const addLock = useRef(false);
  const checkoutLock = useRef(false);
  const [buyInView, setBuyInView] = useState(true);

  /** Bring the size picker on screen and pulse it — used by the in-page buy form. */
  const focusSizes = () => {
    setSizeSheetOpen(false);
    const el = sizesRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setAttention(false);
    window.requestAnimationFrame(() => setAttention(true));
    window.setTimeout(() => setAttention(false), 1400);
  };

  const addToCart = () => {
    if (!orderLines) {
      focusSizes();
      return;
    }
    if (addLock.current) return;
    addLock.current = true;
    let any = false;
    orderLines.forEach((line, index) => {
      if (addLine(line, { openCart: index === orderLines.length - 1 })) any = true;
    });
    if (any) setAdded(true);
    window.setTimeout(() => {
      addLock.current = false;
      setAdded(false);
    }, 1600);
  };

  /** Sticky bar: open the size popup, or checkout once a size is picked. */
  const stickyCheckout = () => {
    if (!orderLines) {
      setSizeSheetOpen(true);
      return;
    }
    if (checkoutLock.current) return;
    checkoutLock.current = true;
    setSizeSheetOpen(false);
    orderLines.forEach((line) => {
      addLine(line, { openCart: false });
    });
    router.push("/checkout");
  };

  const pickStickySize = (next: string) => {
    selectSize(next);
    setSizeSheetOpen(false);
  };

  useEffect(() => {
    if (!sizeSheetOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSizeSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [sizeSheetOpen]);

  useEffect(() => {
    if (!packMode) return;
    if (slots.every((slot) => slot.size)) setSizeSheetOpen(false);
  }, [packMode, slots]);

  useEffect(() => {
    if (!packEligible) {
      setPack(1);
      return;
    }
    if (pack === 2 && deal?.two == null) setPack(deal?.three != null ? 3 : 1);
    if (pack === 3 && deal?.three == null) setPack(deal?.two != null ? 2 : 1);
  }, [packEligible, deal?.two, deal?.three, pack]);

  useEffect(() => {
    const el = buyRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setBuyInView(entry.isIntersecting), {
      rootMargin: "0px 0px -72px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stickyVisible = !locked && !buyInView;
  useEffect(() => {
    const root = document.documentElement;
    if (stickyVisible) root.setAttribute("data-sticky-buy", "1");
    else root.removeAttribute("data-sticky-buy");
    return () => root.removeAttribute("data-sticky-buy");
  }, [stickyVisible]);

  const selectionLabel = packMode ? `Pick ${packQty} sizes` : "Select a size";
  const selectedSummary = packMode
    ? slots.every((slot) => slot.size)
      ? `${packLabel(packQty!, unitLabel)} · ${slots.map((slot) => slot.size).join(" + ")}`
      : `${packLabel(packQty!, unitLabel)} · pick sizes`
    : size
      ? `Size ${size}${quantity > 1 ? ` · ×${quantity}` : ""}`
      : "Pick your size";
  const stickyPrice =
    packMode && packTotal != null ? packTotal : price * (size ? quantity : 1);

  const save2 = deal?.two != null ? packSavings(price, deal.two, 2) : 0;
  const save3 = deal?.three != null ? packSavings(price, deal.three, 3) : 0;
  const bestPack: 2 | 3 | null =
    deal?.three != null && save3 >= save2 ? 3 : deal?.two != null ? 2 : deal?.three != null ? 3 : null;

  const slotDisabled = (slotIndex: number, candidate: Product, sizeValue: string, stock: number) => {
    if (stock === 0) return true;
    let needed = 1;
    slots.forEach((slot, index) => {
      if (index === slotIndex) return;
      if (slot.productId === candidate.id && slot.size === sizeValue) needed += 1;
    });
    return stock < needed;
  };

  const renderPackToggle = (qty: 2 | 3, total: number) => {
    const images = packPreviewImages(qty);
    const save = packSavings(price, total, qty);
    const compare = packCompareAt(price, qty);
    const active = pack === qty;
    const isBest = bestPack === qty;
    return (
      <button
        key={qty}
        type="button"
        role="radio"
        aria-checked={active}
        className={`pack-toggle__btn pack-toggle__btn--deal${active ? " pack-toggle__btn--active" : ""}`}
        onClick={() => setPackMode(qty)}
      >
        {isBest ? <span className="pack-toggle__tag">Best deal</span> : null}
        {images.length > 0 ? (
          <span className={`pack-toggle__media pack-toggle__media--${qty === 2 ? "two" : "three"}`} aria-hidden>
            {images.map((src, index) => (
              <span key={`${src}-${index}`} className="pack-toggle__thumb">
                <Image src={src} alt="" fill sizes="56px" className="pack-toggle__photo object-contain" />
              </span>
            ))}
          </span>
        ) : null}
        <span className="pack-toggle__copy">
          <span className="pack-toggle__label">{packLabel(qty, unitLabel)}</span>
          {save > 0 ? (
            <span className="pack-toggle__save">Save {formatPrice(save)}</span>
          ) : (
            <span className="pack-toggle__sub">Mix colours & sizes</span>
          )}
        </span>
        <span className="pack-toggle__prices">
          <span className="pack-toggle__price tabular-nums">{formatPrice(total)}</span>
          <span className="pack-toggle__was tabular-nums">{formatPrice(compare)}</span>
        </span>
        <span className="pack-toggle__radio" aria-hidden />
      </button>
    );
  };

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
      ) : packMode && packTotal != null ? (
        <p className="product-price mt-2 text-center lg:text-right">
          <span className="text-muted line-through">{formatPrice(packCompareAt(price, packQty!))}</span>{" "}
          <span className="product-price__current">{formatPrice(packTotal)}</span>
          <span className="product-price__pack ui-sm text-muted"> · {packLabel(packQty!, unitLabel)}</span>
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

      {packEligible && !comingSoon && !soldOut && deal ? (
        <div className="pack-toggle mt-4" role="radiogroup" aria-label="Choose pack">
          <button
            type="button"
            role="radio"
            aria-checked={pack === 1}
            className={`pack-toggle__btn${pack === 1 ? " pack-toggle__btn--active" : ""}`}
            onClick={() => setPackMode(1)}
          >
            {packOneImage ? (
              <span className="pack-toggle__media pack-toggle__media--one" aria-hidden>
                <span className="pack-toggle__thumb">
                  <Image src={packOneImage} alt="" fill sizes="64px" className="pack-toggle__photo object-contain" />
                </span>
              </span>
            ) : null}
            <span className="pack-toggle__copy">
              <span className="pack-toggle__label">{packLabel(1, unitLabel)}</span>
              <span className="pack-toggle__sub">Standard price</span>
            </span>
            <span className="pack-toggle__prices">
              <span className="pack-toggle__price tabular-nums">{formatPrice(price)}</span>
              {onSale ? (
                <span className="pack-toggle__was tabular-nums">{formatPrice(product.price)}</span>
              ) : null}
            </span>
            <span className="pack-toggle__radio" aria-hidden />
          </button>
          {deal.two != null ? renderPackToggle(2, deal.two) : null}
          {deal.three != null ? renderPackToggle(3, deal.three) : null}
        </div>
      ) : null}

      {!packMode ? <ProductColourVariants variants={variants} activeId={product.id} /> : null}

      {packMode ? (
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

          <div ref={sizesRef} className={`duo-slots mt-3 space-y-4${attention ? " size-picker--attention" : ""}`}>
            {slots.map((slot, index) => {
              const slotProduct = productById(slot.productId);
              return (
                <div key={index} className="duo-slot">
                  <p className="ui-sm font-bold">
                    {unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1)} {index + 1}
                  </p>

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
                    {sortSizeStocks(slotProduct.sizes).map((entry) => {
                      const disabled = slotDisabled(index, slotProduct, entry.size, entry.stock);
                      const recommended = yourSize === entry.size;
                      return (
                        <button
                          key={entry.size}
                          type="button"
                          disabled={disabled}
                          onClick={() => updateSlot(index, { size: entry.size })}
                          aria-label={recommended ? `${entry.size}, your recommended size` : undefined}
                          className={`ui relative min-h-11 min-w-12 border px-3 py-2 transition-colors lg:min-h-0 lg:min-w-14 lg:py-3 ${
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

          <div
            ref={sizesRef}
            role="group"
            aria-label="Size"
            className={`mt-2 flex flex-wrap justify-center gap-2 lg:justify-start lg:gap-1.5${attention ? " size-picker--attention" : ""}`}
          >
            {sortSizeStocks(product.sizes).map((entry) => {
              const disabled = entry.stock === 0;
              const recommended = yourSize === entry.size;
              return (
                <button
                  key={entry.size}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectSize(entry.size)}
                  aria-pressed={size === entry.size}
                  aria-label={
                    disabled
                      ? `${entry.size}, sold out`
                      : recommended
                        ? `${entry.size}, your recommended size`
                        : undefined
                  }
                  className={`ui relative min-h-12 min-w-14 border px-3 py-2 transition-colors lg:min-h-0 lg:min-w-16 lg:py-5 ${
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

      {!locked ? (
        <div id="product-buy-now" ref={buyRef}>
          <ProductBuyNowForm
            lines={orderLines ?? []}
            shippingRate={shippingRate}
            onNeedSelection={focusSizes}
            selectionLabel={selectionLabel}
            afterPlaceOrder={
              <div className="flex items-stretch gap-2">
                {!packMode && size ? (
                  <div className="flex items-center border border-line">
                    <button
                      type="button"
                      onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                      disabled={quantity <= 1}
                      aria-label="Decrease quantity"
                      className="ui h-11 w-10 disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="ui w-7 text-center tabular-nums" aria-live="polite">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((value) => Math.min(Math.min(selectedStock, MAX_LINE_QUANTITY), value + 1))}
                      disabled={quantity >= Math.min(selectedStock, MAX_LINE_QUANTITY)}
                      aria-label="Increase quantity"
                      className="ui h-11 w-10 disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={addToCart}
                  aria-live="polite"
                  className={`btn btn--solid min-w-[150px] flex-1${added ? " btn--added" : ""}`}
                >
                  {added ? "Added to cart ✓" : orderLines ? "Add to cart" : selectionLabel}
                </button>
              </div>
            }
          />
        </div>
      ) : null}

      {/* Portalled: a transformed ancestor would pin position:fixed to the page instead of the viewport. */}
      {stickyVisible || sizeSheetOpen
        ? createPortal(
            <>
              {sizeSheetOpen ? (
                <div className="sticky-size-sheet lg:hidden" role="dialog" aria-modal="true" aria-label="Select a size">
                  <button
                    type="button"
                    className="sticky-size-sheet__backdrop"
                    aria-label="Close"
                    tabIndex={-1}
                    onClick={() => setSizeSheetOpen(false)}
                  />
                  <div className="sticky-size-sheet__panel">
                    <div className="sticky-size-sheet__grab" aria-hidden>
                      <span className="sticky-size-sheet__handle" />
                    </div>
                    <div className="sticky-size-sheet__head">
                      <p className="sticky-size-sheet__title">
                        {packMode ? `Pick ${packQty} sizes` : "Select a size"}
                      </p>
                      <button
                        type="button"
                        className="sticky-size-sheet__close"
                        aria-label="Close"
                        onClick={() => setSizeSheetOpen(false)}
                      >
                        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                          <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>

                    {packMode ? (
                      <div className="sticky-size-sheet__duo">
                        {slots.map((slot, index) => {
                          const slotProduct = productById(slot.productId);
                          return (
                            <div key={index} className="sticky-size-sheet__duo-block">
                              <p className="sticky-size-sheet__label">
                                {unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1)} {index + 1}
                              </p>
                              {colourOptions.length > 1 ? (
                                <div className="sticky-size-sheet__colours">
                                  {colourOptions.map((option) => {
                                    const current = option.id === slot.productId;
                                    return (
                                      <button
                                        key={option.id}
                                        type="button"
                                        aria-label={option.colorway || option.name}
                                        aria-pressed={current}
                                        onClick={() => updateSlot(index, { productId: option.id, size: "" })}
                                        className={`sticky-size-sheet__colour${current ? " is-on" : ""}`}
                                      >
                                        <Image
                                          src={option.images[0]}
                                          alt=""
                                          fill
                                          sizes="56px"
                                          className="object-contain p-1"
                                        />
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                              <div
                                className="sticky-size-sheet__sizes"
                                role="group"
                                aria-label={`${unitLabel} ${index + 1} size`}
                              >
                                {sortSizeStocks(slotProduct.sizes).map((entry) => {
                                  const disabled = slotDisabled(index, slotProduct, entry.size, entry.stock);
                                  return (
                                    <button
                                      key={entry.size}
                                      type="button"
                                      disabled={disabled}
                                      aria-pressed={slot.size === entry.size}
                                      className={`sticky-size-sheet__size${slot.size === entry.size ? " is-on" : ""}${
                                        disabled ? " is-out" : ""
                                      }`}
                                      onClick={() => updateSlot(index, { size: entry.size })}
                                    >
                                      {entry.size}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="sticky-size-sheet__sizes" role="group" aria-label="Size">
                        {sortSizeStocks(product.sizes).map((entry) => {
                          const disabled = entry.stock === 0;
                          return (
                            <button
                              key={entry.size}
                              type="button"
                              disabled={disabled}
                              aria-pressed={size === entry.size}
                              className={`sticky-size-sheet__size${size === entry.size ? " is-on" : ""}${
                                disabled ? " is-out" : ""
                              }`}
                              onClick={() => pickStickySize(entry.size)}
                            >
                              {entry.size}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {stickyVisible ? (
                <div className="product-sticky-buy lg:hidden" role="region" aria-label="Quick buy">
                  <div className="product-sticky-buy__info">
                    <span className="product-sticky-buy__name">{product.name}</span>
                    <span className="product-sticky-buy__meta">
                      <span className="product-price__current tabular-nums">{formatPrice(stickyPrice)}</span>
                      <span aria-hidden> · </span>
                      <span>{selectedSummary}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={stickyCheckout}
                    className="btn btn--solid product-sticky-buy__cta"
                  >
                    {orderLines ? "Checkout" : selectionLabel}
                  </button>
                </div>
              ) : null}
            </>,
            document.body,
          )
        : null}

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
            if (packMode) {
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

function defaultSlots(
  product: Product,
  colourOptions: Product[],
  seedSize: string,
  count: 2 | 3,
): PackSlot[] {
  const slots: PackSlot[] = [];
  for (let i = 0; i < count; i++) {
    const option = colourOptions[i % colourOptions.length] ?? product;
    slots.push({
      productId: option.id,
      size: i === 0 ? seedSize : "",
    });
  }
  return slots;
}

function RulerGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-guide-link__icon" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2.5" y="7.5" width="19" height="9" rx="1" />
      <path d="M6.5 7.5v3M10 7.5v4.5M13.5 7.5v3M17 7.5v4.5" />
    </svg>
  );
}
