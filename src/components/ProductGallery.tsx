"use client";

import Image from "next/image";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ProductLightbox } from "@/components/ProductLightbox";
import { ChevronGlyph } from "@/components/SocialGlyphs";
import {
  detectProductImageKindFromImg,
  readCachedProductImageKind,
  seedProductImageKind,
  type ProductImageKind,
} from "@/lib/productImageKind";

export function ProductGallery({
  images,
  name,
  imageKinds,
}: {
  images: string[];
  name: string;
  /** SSR-resolved kinds — same on server + first client paint (no flash). */
  imageKinds?: ProductImageKind[];
}) {
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [kinds, setKinds] = useState<ProductImageKind[]>(() =>
    images.map((_, index) => imageKinds?.[index] ?? "cutout"),
  );
  const multi = images.length > 1;
  const railRef = useRef<HTMLDivElement>(null);
  const tap = useRef<{ x: number; y: number } | null>(null);
  const hasServerKinds = Boolean(imageKinds && imageKinds.length === images.length);

  useLayoutEffect(() => {
    setKinds(
      images.map((src, index) => {
        const fromServer = imageKinds?.[index];
        if (fromServer) {
          seedProductImageKind(src, fromServer);
          return fromServer;
        }
        return readCachedProductImageKind(src) ?? "cutout";
      }),
    );
  }, [images, imageKinds]);

  const setKindAt = useCallback((index: number, kind: ProductImageKind) => {
    setKinds((prev) => {
      if (prev[index] === kind) return prev;
      const next = prev.slice();
      next[index] = kind;
      return next;
    });
  }, []);

  const onImageLoad = useCallback(
    (src: string, index: number, event: React.SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget;
      if (!img.naturalWidth) return;
      // Server already classified — only refresh the shared cache, don't restyle.
      if (hasServerKinds) {
        detectProductImageKindFromImg(src, img);
        return;
      }
      setKindAt(index, detectProductImageKindFromImg(src, img));
    },
    [hasServerKinds, setKindAt],
  );

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

  const onRailScroll = () => {
    const rail = railRef.current;
    const width = slideWidth();
    if (!rail || width <= 0) return;
    const next = Math.min(images.length - 1, Math.max(0, Math.round(rail.scrollLeft / width)));
    setActive((current) => (current === next ? current : next));
  };

  const kindOf = (index: number): ProductImageKind => kinds[index] ?? "cutout";
  const isLifestyle = (index: number) => kindOf(index) === "lifestyle";
  const frameClass = (index: number) =>
    `media-frame product-gallery__main${
      isLifestyle(index) ? " product-gallery__main--lifestyle" : " product-gallery__main--cutout"
    }`;
  const photoClass = (index: number) =>
    isLifestyle(index)
      ? "product-gallery__photo product-gallery__photo--lifestyle"
      : "product-gallery__photo product-gallery__photo--cutout";

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
              className={`product-gallery__thumb${
                isLifestyle(index) ? " product-gallery__thumb--lifestyle" : " product-gallery__thumb--cutout"
              }${index === active ? " product-gallery__thumb--active" : ""}`}
              onClick={() => goTo(index)}
            >
              <Image
                src={image}
                alt=""
                aria-hidden
                fill
                sizes="72px"
                className={isLifestyle(index) ? "object-cover object-center" : "object-contain p-1"}
                onLoad={(event) => onImageLoad(image, index, event)}
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
                className={`${frameClass(index)} product-gallery__slide cursor-zoom-in`}
                data-image-kind={kindOf(index)}
              >
                <Image
                  src={image}
                  alt={`${name} — view ${index + 1}`}
                  fill
                  priority={index === 0}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  quality={75}
                  sizes="(min-width: 1024px) 520px, 100vw"
                  className={photoClass(index)}
                  draggable={false}
                  onLoad={(event) => onImageLoad(image, index, event)}
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
          className={`${frameClass(active)} cursor-zoom-in`}
          data-image-kind={kindOf(active)}
        >
          <Image
            src={images[active]}
            alt={`${name} — view ${active + 1}`}
            fill
            priority={active === 0}
            loading={active === 0 ? "eager" : "lazy"}
            fetchPriority={active === 0 ? "high" : "auto"}
            quality={100}
            sizes="(min-width: 1280px) 520px, (min-width: 1024px) 460px, (min-width: 640px) 480px, 90vw"
            className={photoClass(active)}
            draggable={false}
            onLoad={(event) => onImageLoad(images[active] ?? "", active, event)}
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
