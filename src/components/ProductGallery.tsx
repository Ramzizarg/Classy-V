"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ChevronGlyph, CloseGlyph } from "@/components/SocialGlyphs";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const step = (delta: number) =>
    setActive((current) => (current + delta + images.length) % images.length);

  /** The overlay opens on the view that was clicked rather than at the top of the strip. */
  const scrollToActive = useCallback((node: HTMLDivElement | null) => {
    node?.scrollIntoView({ block: "start" });
  }, []);

  useEffect(() => {
    if (!expanded) return;

    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

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
        <div
          className="camo-surface fixed inset-0 z-[220] overflow-y-auto"
          role="dialog"
          aria-modal
          aria-label={`${name} images`}
        >
          <div className="camo-surface sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line px-3 py-2.5">
            <span className="ui font-bold">{name}</span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Close gallery"
              className="-m-1 p-1 hover:opacity-70"
            >
              <CloseGlyph className="h-5 w-5" />
            </button>
          </div>

          {images.map((image, index) => (
            <div
              key={image}
              ref={index === active ? scrollToActive : undefined}
              className="media-frame aspect-square w-full border-b border-line"
            >
              <Image
                src={image}
                alt={`${name} — view ${index + 1}`}
                fill
                sizes="100vw"
                className="h-full w-full object-contain p-6"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
