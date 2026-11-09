"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ProductLightbox } from "@/components/ProductLightbox";
import { ChevronGlyph } from "@/components/SocialGlyphs";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [tall, setTall] = useState<Record<number, boolean>>({});
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

  const step = (delta: number) => {
    goTo((active + delta + images.length) % images.length);
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

  const markTall = (index: number) => (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (img.naturalWidth < 1 || img.naturalHeight < 1) return;
    const isTall = img.naturalHeight / img.naturalWidth > 1.08;
    setTall((current) => (current[index] === isTall ? current : { ...current, [index]: isTall }));
  };

  const photoClass = (index: number) =>
    tall[index]
      ? "product-gallery__photo--tall h-full w-full object-cover object-center"
      : "h-full w-full object-contain p-1 sm:p-2";

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
                sizes="72px"
                className="object-cover object-top p-1"
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
                className={`media-frame product-gallery__main product-gallery__slide cursor-zoom-in${
                  tall[index] ? " product-gallery__main--photo" : ""
                }`}
              >
                <Image
                  src={image}
                  alt={`${name} — view ${index + 1}`}
                  fill
                  /* Only the first slide is high-priority; avoid unused link-preload warnings. */
                  priority={index === 0}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  quality={index === 0 ? 90 : 75}
                  sizes="(min-width: 1024px) 520px, 100vw"
                  onLoad={markTall(index)}
                  className={photoClass(index)}
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
          className={`media-frame product-gallery__main cursor-zoom-in${
            active >= 2
              ? " product-gallery__main--later"
              : tall[active]
                ? " product-gallery__main--photo"
                : ""
          }`}
        >
          <Image
            src={images[active]}
            alt={`${name} — view ${active + 1}`}
            fill
            priority={!multi}
            fetchPriority={!multi ? "high" : undefined}
            quality={100}
            sizes="(min-width: 1280px) 520px, (min-width: 1024px) 460px, (min-width: 640px) 480px, 90vw"
            onLoad={markTall(active)}
            className={
              active >= 2
                ? "product-gallery__photo--later h-full w-full object-contain"
                : photoClass(active)
            }
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
          onIndexChange={setActive}
          onClose={() => {
            setExpanded(false);
            scrollRailTo(active);
          }}
        />
      ) : null}
    </div>
  );
}
