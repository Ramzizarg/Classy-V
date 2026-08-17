"use client";

import Image from "next/image";
import { useState } from "react";
import { ProductLightbox } from "@/components/ProductLightbox";
import { ChevronGlyph } from "@/components/SocialGlyphs";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const step = (delta: number) =>
    setActive((current) => (current + delta + images.length) % images.length);

  return (
    <div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={`View all ${name} images`}
          className="media-frame block aspect-square w-full cursor-zoom-in"
        >
          <Image
            src={images[active]}
            alt={`${name} — view ${active + 1}`}
            fill
            priority
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="h-full w-full object-contain p-6 sm:p-10"
          />
        </button>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous view"
              className="absolute top-1/2 left-1 -translate-y-1/2 p-2 text-foreground/70 hover:text-foreground sm:left-2"
            >
              <ChevronGlyph className="h-5 w-5 rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next view"
              className="absolute top-1/2 right-1 -translate-y-1/2 p-2 text-foreground/70 hover:text-foreground sm:right-2"
            >
              <ChevronGlyph className="h-5 w-5" />
            </button>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Show view ${index + 1}`}
              aria-current={index === active}
              className={`media-frame aspect-square w-16 transition-opacity sm:w-20 ${
                index === active ? "opacity-100" : "opacity-40 hover:opacity-70"
              }`}
            >
              <Image
                src={image}
                alt=""
                aria-hidden
                fill
                sizes="20vw"
                className="h-full w-full object-contain"
              />
            </button>
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
