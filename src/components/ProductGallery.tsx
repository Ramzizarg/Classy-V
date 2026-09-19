"use client";

import Image from "next/image";
import { useState } from "react";
import { ProductLightbox } from "@/components/ProductLightbox";
import { ChevronGlyph } from "@/components/SocialGlyphs";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const multi = images.length > 1;
  const step = (delta: number) =>
    setActive((current) => (current + delta + images.length) % images.length);

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
          onClick={() => setExpanded(true)}
          aria-label={`View all ${name} images`}
          className="media-frame product-gallery__main cursor-zoom-in"
        >
          <Image
            src={images[active]}
            alt={`${name} — view ${active + 1}`}
            fill
            priority
            sizes="(min-width: 1280px) 520px, (min-width: 1024px) 460px, (min-width: 640px) 480px, 90vw"
            className="h-full w-full object-contain p-1 sm:p-2"
          />
        </button>

        {multi ? (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous view"
              className="product-gallery__chevron product-gallery__chevron--prev"
            >
              <ChevronGlyph className="h-5 w-5 rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next view"
              className="product-gallery__chevron product-gallery__chevron--next"
            >
              <ChevronGlyph className="h-5 w-5" />
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
