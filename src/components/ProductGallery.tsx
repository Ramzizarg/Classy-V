"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ProductLightbox } from "@/components/ProductLightbox";
import { ChevronGlyph } from "@/components/SocialGlyphs";

const SWIPE_PX = 36;
const TAP_PX = 10;

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const multi = images.length > 1;
  const touch = useRef<{ x: number; y: number; axis: "none" | "x" | "y" } | null>(null);
  const suppressClick = useRef(false);

  const step = (delta: number) =>
    setActive((current) => (current + delta + images.length) % images.length);

  const onTouchStart = (event: React.TouchEvent) => {
    if (!multi) return;
    const t = event.touches[0];
    if (!t) return;
    touch.current = { x: t.clientX, y: t.clientY, axis: "none" };
    suppressClick.current = false;
  };

  const onTouchMove = (event: React.TouchEvent) => {
    const start = touch.current;
    const t = event.touches[0];
    if (!start || !t || !multi) return;

    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (start.axis === "none") {
      if (Math.abs(dx) < TAP_PX && Math.abs(dy) < TAP_PX) return;
      start.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    }

    if (start.axis === "x") {
      suppressClick.current = true;
    }
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || !multi) return;

    const t = event.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - start.x;
    if (start.axis === "x" && Math.abs(dx) >= SWIPE_PX) {
      suppressClick.current = true;
      step(dx < 0 ? 1 : -1);
    }
  };

  const onTouchCancel = () => {
    touch.current = null;
  };

  const openLightbox = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setExpanded(true);
  };

  return (
    <div className="product-gallery">
      {multi ? (
        <div className="product-gallery__thumbs" role="tablist" aria-label={`${name} images`}>
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              role="tab"
              aria-label={`Show view ${index + 1}`}
              aria-selected={index === active}
              className={`product-gallery__thumb${index === active ? " product-gallery__thumb--active" : ""}`}
              onClick={() => setActive(index)}
            >
              <Image
                src={image}
                alt=""
                aria-hidden
                fill
                sizes="64px"
                className="object-contain p-0.5"
              />
            </button>
          ))}
        </div>
      ) : null}

      <div className="product-gallery__stage">
        <button
          type="button"
          onClick={openLightbox}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchCancel}
          aria-label={multi ? `View ${name} images — swipe to change` : `View all ${name} images`}
          className={`media-frame product-gallery__main cursor-zoom-in${
            multi ? " product-gallery__main--swipe" : ""
          }`}
        >
          <Image
            src={images[active]}
            alt={`${name} — view ${active + 1}`}
            fill
            priority
            quality={100}
            sizes="(min-width: 1280px) 520px, (min-width: 1024px) 460px, (min-width: 640px) 480px, 90vw"
            className="h-full w-full object-contain p-1 sm:p-2"
            draggable={false}
          />
        </button>

        {multi ? (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                step(-1);
              }}
              aria-label="Previous view"
              className="product-gallery__chevron product-gallery__chevron--prev"
            >
              <ChevronGlyph className="h-4 w-4 rotate-180" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                step(1);
              }}
              aria-label="Next view"
              className="product-gallery__chevron product-gallery__chevron--next"
            >
              <ChevronGlyph className="h-4 w-4" />
            </button>
            <p className="product-gallery__count" aria-live="polite">
              {active + 1} / {images.length}
            </p>
          </>
        ) : null}
      </div>

      {multi ? (
        <div className="gallery-dots product-gallery__dots" role="tablist" aria-label="Product images">
          {images.map((image, index) => (
            <button
              key={`${image}-dot-${index}`}
              type="button"
              role="tab"
              onClick={() => setActive(index)}
              aria-label={`Show view ${index + 1}`}
              aria-selected={index === active}
              className={`gallery-dots__dot ${index === active ? "gallery-dots__dot--active" : ""}`}
            />
          ))}
        </div>
      ) : null}

      {expanded ? (
        <ProductLightbox
          images={images}
          name={name}
          index={active}
          onIndexChange={setActive}
          onClose={() => setExpanded(false)}
        />
      ) : null}
    </div>
  );
}
