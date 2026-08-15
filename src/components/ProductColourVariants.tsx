import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";

/**
 * Thumbnails linking to the same piece in its other colours. Each colourway is
 * its own product, so picking one navigates rather than mutating state.
 */
export function ProductColourVariants({
  variants,
  activeId,
}: {
  variants: Product[];
  activeId: number;
}) {
  if (variants.length < 2) return null;

  return (
    <div className="mt-5">
      <p className="ui-sm text-muted">Colour</p>

      <div className="mt-2 flex flex-wrap justify-center gap-1.5 lg:justify-start">
        {variants.map((variant) => {
          const current = variant.id === activeId;
          return (
            <Link
              key={variant.id}
              href={`/collection/${variant.slug}`}
              aria-label={variant.name}
              aria-current={current ? "page" : undefined}
              className={`media-frame h-20 w-20 border transition-colors lg:h-24 lg:w-24 ${
                current ? "border-price" : "border-line hover:border-foreground"
              }`}
            >
              <Image
                src={variant.images[0]}
                alt={variant.name}
                fill
                sizes="96px"
                className="h-full w-full object-contain p-1"
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
