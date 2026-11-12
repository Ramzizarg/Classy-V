"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/components/StoreProvider";
import { formatPrice } from "@/lib/format";
import { effectivePrice, isComingSoon, isSoldOut, productHoverImage } from "@/lib/products";
import { sortSizeStocks } from "@/lib/productSizesDisplay";
import type { Product } from "@/lib/types";

/**
 * Side panel to pick a size and add to cart without leaving the page.
 * Portalled to <body>: the home sheet is transformed, which would trap `position: fixed`.
 */
export function QuickAddDrawer({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { addLine } = useStore();
  const [size, setSize] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const grab = useRef<{ y: number; dy: number } | null>(null);

  /** Mobile sheet: drag the handle down to dismiss, like a native bottom sheet. */
  const onGrabDown = (event: React.PointerEvent<HTMLDivElement>) => {
    grab.current = { y: event.clientY, dy: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    panelRef.current?.classList.add("is-dragging");
  };
  const onGrabMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!grab.current || !panelRef.current) return;
    grab.current.dy = Math.max(0, event.clientY - grab.current.y);
    panelRef.current.style.transform = `translateY(${grab.current.dy}px)`;
  };
  const onGrabEnd = () => {
    const panel = panelRef.current;
    const dy = grab.current?.dy ?? 0;
    grab.current = null;
    if (!panel) return;
    panel.classList.remove("is-dragging");
    if (dy > 110) {
      onClose();
      return;
    }
    panel.style.transform = "";
  };

  useEffect(() => {
    if (!product) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [product, onClose]);

  if (!product || typeof document === "undefined") return null;

  const comingSoon = isComingSoon(product);
  const soldOut = !comingSoon && isSoldOut(product);
  const price = effectivePrice(product);
  const onSale = price < product.price;
  const locked = comingSoon || soldOut;

  const addToCart = () => {
    if (!size || locked) return;
    addLine({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      unitPrice: price,
      compareAtPrice: onSale ? product.price : null,
      image: product.images[0],
      hoverImage: productHoverImage(product.images),
      size,
      colorway: product.colorway,
      quantity: 1,
    });
    onClose();
  };

  return createPortal(
    <div className="quick-add" role="dialog" aria-modal="true" aria-label={`Add ${product.name} to cart`}>
      <button type="button" className="quick-add__backdrop" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <aside ref={panelRef} className="quick-add__panel">
        <div
          className="quick-add__grab"
          aria-hidden
          onPointerDown={onGrabDown}
          onPointerMove={onGrabMove}
          onPointerUp={onGrabEnd}
          onPointerCancel={onGrabEnd}
        >
          <span className="quick-add__handle" />
        </div>
        <header className="quick-add__head">
          <Link href={`/collection/${product.slug}`} className="quick-add__name hover-underline" onClick={onClose}>
            {product.name}
          </Link>
          <button ref={closeRef} type="button" className="quick-add__close" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
              <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="quick-add__media">
          <Image src={product.images[0]} alt={product.name} fill sizes="(min-width: 768px) 520px, 100vw" className="quick-add__img" />
        </div>

        <div className="quick-add__body">
          <p className="quick-add__label">Size</p>
          <div className="quick-add__sizes" role="radiogroup" aria-label="Size">
            {sortSizeStocks(product.sizes).map((entry) => {
              const out = entry.stock < 1;
              return (
                <button
                  key={entry.size}
                  type="button"
                  role="radio"
                  aria-checked={size === entry.size}
                  disabled={out || locked}
                  className={`quick-add__size${size === entry.size ? " is-on" : ""}${out ? " is-out" : ""}`}
                  onClick={() => setSize(entry.size)}
                >
                  {entry.size}
                </button>
              );
            })}
          </div>

          <button type="button" className="quick-add__cta" disabled={locked || !size} onClick={addToCart}>
            {comingSoon ? (
              "Coming soon"
            ) : soldOut ? (
              "Sold out"
            ) : (
              <>
                <span>{size ? "Add to cart" : "Select a size"}</span>
                <span className="tabular-nums">{formatPrice(price)}</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
