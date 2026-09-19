"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { getSizeOptionsForProduct } from "@/lib/productSizesDisplay";
import { effectivePrice, isSoldOut } from "@/lib/products";
import type { Product } from "@/lib/types";

const SWIPE_PX = 28;
const TAP_PX = 10;

/** Catalog tile: swipe on touch; desktop hover shows sizes + image arrows. */
export function LookbookCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const router = useRouter();
  const soldOut = isSoldOut(product);
  const price = effectivePrice(product);
  const images = product.images.length > 0 ? product.images : ["/images/loogo.png"];
  const multi = images.length > 1;
  const href = `/collection/${product.slug}`;
  const sizeOptions = getSizeOptionsForProduct(product);
  const showSizes = !soldOut && sizeOptions.some((o) => o.available);
  const [active, setActive] = useState(0);
  const touch = useRef<{ x: number; y: number; axis: "none" | "x" | "y" } | null>(null);
  const suppressClick = useRef(false);
  const sizesAttr = "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw";

  const goTo = useCallback(
    (index: number) => {
      const len = images.length;
      setActive(((index % len) + len) % len);
    },
    [images.length]
  );

  const openProduct = () => {
    router.push(href);
  };

  const onTouchStart = (event: React.TouchEvent) => {
    const t = event.touches[0];
    if (!t) return;
    touch.current = { x: t.clientX, y: t.clientY, axis: "none" };
    suppressClick.current = false;
  };

  const onTouchMove = (event: React.TouchEvent) => {
    const start = touch.current;
    const t = event.touches[0];
    if (!start || !t) return;

    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (start.axis === "none") {
      if (Math.abs(dx) < TAP_PX && Math.abs(dy) < TAP_PX) return;
      start.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    }

    if (start.axis === "x" && multi) {
      suppressClick.current = true;
    }
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;

    const t = event.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (multi && start.axis === "x" && Math.abs(dx) >= SWIPE_PX) {
      suppressClick.current = true;
      goTo(active + (dx < 0 ? 1 : -1));
      return;
    }

    if (!suppressClick.current && Math.abs(dx) < TAP_PX && Math.abs(dy) < TAP_PX) {
      suppressClick.current = true;
      openProduct();
    }
  };

  const onTouchCancel = () => {
    touch.current = null;
  };

  const onMediaClick = (event: React.MouseEvent) => {
    if (suppressClick.current) {
      event.preventDefault();
      suppressClick.current = false;
      return;
    }
    openProduct();
  };

  const stepImage = (event: React.MouseEvent, dir: -1 | 1) => {
    event.preventDefault();
    event.stopPropagation();
    goTo(active + dir);
    /* Drop button focus so sizes/arrows don't stay open after the mouse leaves. */
    (event.currentTarget as HTMLButtonElement).blur();
  };

  return (
    <article
      className="lookbook-card"
      onMouseLeave={(event) => {
        const activeEl = document.activeElement;
        if (activeEl instanceof HTMLElement && event.currentTarget.contains(activeEl)) {
          activeEl.blur();
        }
      }}
    >
      <div
        className={`lookbook-card__media${multi ? " lookbook-card__media--swipe" : ""}`}
        role="link"
        tabIndex={0}
        aria-label={`View ${product.name}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        onClick={onMediaClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openProduct();
          }
          if (multi && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
            event.preventDefault();
            goTo(active + (event.key === "ArrowRight" ? 1 : -1));
          }
        }}
      >
        {images.map((src, index) => (
          <Image
            key={`${src}-${index}`}
            src={src}
            alt={index === active ? product.name : ""}
            aria-hidden={index !== active}
            fill
            sizes={sizesAttr}
            priority={priority && index === 0}
            loading={priority && index === 0 ? "eager" : "lazy"}
            fetchPriority={priority && index === 0 ? "high" : "auto"}
            className={`lookbook-card__img${index === active ? " lookbook-card__img--active" : ""}`}
            draggable={false}
          />
        ))}
        {soldOut ? <span className="lookbook-card__badge">Sold out</span> : null}

        {multi ? (
          <>
            <button
              type="button"
              className="lookbook-card__nav lookbook-card__nav--prev"
              aria-label="Previous image"
              onClick={(event) => stepImage(event, -1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="lookbook-card__nav lookbook-card__nav--next"
              aria-label="Next image"
              onClick={(event) => stepImage(event, 1)}
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      {showSizes ? (
        <div className="lookbook-card__sizes" aria-label="Available sizes">
          {sizeOptions.map((option) => (
            <Link
              key={option.label}
              href={href}
              className={`lookbook-card__size${option.available ? "" : " lookbook-card__size--gone"}`}
              tabIndex={option.available ? undefined : -1}
              aria-disabled={!option.available}
              onClick={(event) => event.stopPropagation()}
            >
              {option.label}
            </Link>
          ))}
        </div>
      ) : null}

      {multi ? (
        <div className="lookbook-card__dots" role="tablist" aria-label={`${product.name} images`}>
          {images.map((src, index) => (
            <button
              key={`${src}-dot-${index}`}
              type="button"
              role="tab"
              aria-label={`Show image ${index + 1}`}
              aria-selected={index === active}
              className={`lookbook-card__dot${index === active ? " lookbook-card__dot--active" : ""}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                goTo(index);
              }}
            />
          ))}
        </div>
      ) : null}

      <Link href={href} className="lookbook-card__copy">
        <h3 className="lookbook-card__title">{product.name}</h3>
        <p className="lookbook-card__price">{formatPrice(price)}</p>
      </Link>
    </article>
  );
}
