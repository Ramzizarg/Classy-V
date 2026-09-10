import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { effectivePrice, isSoldOut } from "@/lib/products";
import type { Product } from "@/lib/types";

/** Illicitbloc-style catalog tile: portrait photo, title + price under. */
export function LookbookCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const soldOut = isSoldOut(product);
  const price = effectivePrice(product);
  const sizes =
    "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw";

  return (
    <article className="lookbook-card">
      <Link href={`/collection/${product.slug}`} className="lookbook-card__link">
        <div className="lookbook-card__media">
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes={sizes}
            priority={priority}
            className="lookbook-card__img lookbook-card__img--primary"
          />
          {product.images[1] ? (
            <Image
              src={product.images[1]}
              alt=""
              aria-hidden
              fill
              sizes={sizes}
              className="lookbook-card__img lookbook-card__img--secondary"
            />
          ) : null}
          {soldOut ? <span className="lookbook-card__badge">Sold out</span> : null}
        </div>

        <div className="lookbook-card__copy">
          <h3 className="lookbook-card__title">{product.name}</h3>
          <p className="lookbook-card__price">{formatPrice(price)}</p>
        </div>
      </Link>
    </article>
  );
}
