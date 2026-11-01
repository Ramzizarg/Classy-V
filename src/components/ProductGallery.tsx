"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ProductLightbox } from "@/components/ProductLightbox";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const multi = images.length > 1;
  const railRef = useRef<HTMLDivElement>(null);
  const tap = useRef<{ x: number; y: number } | null>(null);

  const openLightbox = (index: number) => {
    setActive(index);
    setExpanded(true);
  };

  const slideWidth = () => {
    const rail = railRef.current;
    const first = rail?.firstElementChild as HTMLElement | null;
    if (!rail || !first || first.offsetWidth < 80) return 0;
    const gap = parseFloat(getComputedStyle(rail).columnGap || getComputedStyle(rail).gap) || 0;
    return first.offsetWidth + gap;
  };

  const scrollRailTo = (index: number) => {
    const rail = railRef.current;
    const width = slideWidth();
    if (!rail || width <= 0) return;
    rail.scrollTo({ left: index * width, behavior: "smooth" });
  };

  const goTo = (index: number) => {
    setActive(index);
    scrollRailTo(index);
  };

  const onRailPointerDown = (event: React.PointerEvent) => {
    tap.current = { x: event.clientX, y: event.clientY };
  };

  const onSlideClick = (index: number) => (event: React.MouseEvent) => {
    const start = tap.current;
    tap.current = null;
    if (start && (Math.abs(event.clientX - start.x) > 8 || Math.abs(event.clientY - start.y) > 8)) {
      event.preventDefault();
      return;
    }
    openLightbox(index);
  };

  const onRailScroll = () => {
    const rail = railRef.current;
    const width = slideWidth();
    if (!rail || width <= 0) return;
    const next = Math.min(images.length - 1, Math.max(0, Math.round(rail.scrollLeft / width)));
    setActive((current) => (current === next ? current : next));
  };

  return (
    <div className={`product-gallery${multi ? " product-gallery--multi" : ""}`}>
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
              onClick={() => goTo(index)}
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

      {multi ? (
        <div className="product-gallery__viewport">
          <div
            ref={railRef}
            className="product-gallery__rail"
            role="region"
            aria-roledescription="carousel"
            aria-label={`${name} images`}
            data-no-pull-refresh
            onScroll={onRailScroll}
            onPointerDown={onRailPointerDown}
          >
            {images.map((image, index) => (
              <div
                key={`${image}-rail-${index}`}
                role="button"
                tabIndex={0}
                onClick={onSlideClick(index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openLightbox(index);
                  }
                }}
                aria-label={`View ${name} image ${index + 1} of ${images.length}`}
                className="media-frame product-gallery__main product-gallery__slide cursor-zoom-in"
              >
                <Image
                  src={image}
                  alt={`${name} — view ${index + 1}`}
                  fill
                  priority={index === 0}
                  fetchPriority={index === 0 ? "high" : undefined}
                  quality={100}
                  sizes="100vw"
                  className="h-full w-full object-contain p-1"
                  draggable={false}
                />
              </div>
            ))}
          </div>
          <p className="product-gallery__count" aria-live="polite">
            {active + 1} / {images.length}
          </p>
        </div>
      ) : null}

      <div className="product-gallery__stage">
        <button
          type="button"
          onClick={() => openLightbox(active)}
          aria-label={`View all ${name} images`}
          className="media-frame product-gallery__main cursor-zoom-in"
        >
          <Image
            src={images[active]}
            alt={`${name} — view ${active + 1}`}
            fill
            priority={!multi}
            fetchPriority={!multi ? "high" : undefined}
            quality={100}
            sizes="(min-width: 1280px) 520px, (min-width: 1024px) 460px, (min-width: 640px) 480px, 90vw"
            className="h-full w-full object-contain p-1 sm:p-2"
            draggable={false}
          />
        </button>
      </div>

      {multi ? (
        <div className="gallery-dots product-gallery__dots" role="tablist" aria-label="Product images">
          {images.map((image, index) => (
            <button
              key={`${image}-dot-${index}`}
              type="button"
              role="tab"
              onClick={() => goTo(index)}
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
          onIndexChange={goTo}
          onClose={() => setExpanded(false)}
        />
      ) : null}
    </div>
  );
}
