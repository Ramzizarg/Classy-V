"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import { ProductCountdown } from "@/components/ProductCountdown";
import { formatPrice } from "@/lib/format";
import { effectivePrice, isComingSoon, isSoldOut } from "@/lib/products";
import type { Product } from "@/lib/types";

export function ProductCard({
  product,
  priority = false,
  sizes = "(min-width: 1800px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 46vw, 46vw",
}: {
  product: Product;
  priority?: boolean;
  sizes?: string;
}) {
  const comingSoon = isComingSoon(product);
  const soldOut = !comingSoon && isSoldOut(product);
  const price = effectivePrice(product);
  const [dropUrgent, setDropUrgent] = useState(false);
  const onDropUrgent = useCallback((urgent: boolean) => setDropUrgent(urgent), []);

  return (
    <article
      className={`product-card product-card--catalog${comingSoon ? " product-card--coming-soon" : ""}${
        comingSoon && dropUrgent ? " product-card--drop-urgent" : ""
      }`}
    >
      <Link href={`/collection/${product.slug}`} className="flex h-full flex-col">
        <div className="media-frame product-card__media w-full">
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes={sizes}
            priority={priority}
            className="media-primary absolute inset-0 h-full w-full object-contain"
          />
          <Image
            src={product.images[1] ?? product.images[0]}
            alt=""
            aria-hidden
            fill
            sizes={sizes}
            className="media-secondary absolute inset-0 h-full w-full object-contain opacity-0"
          />
          {comingSoon ? (
            <>
              <span className="product-card__badge product-card__badge--coming-soon">Coming soon</span>
              <div className="product-card__drop">
                <ProductCountdown
                  endsAt={product.releaseAt}
                  variant="overlay"
                  onUrgentChange={onDropUrgent}
                />
              </div>
            </>
          ) : soldOut ? (
            <span className="product-card__badge">Sold out</span>
          ) : null}
        </div>

        <div className="product-card__copy">
          <h3 className="product-card__title">{product.name}</h3>
          {comingSoon ? null : soldOut ? (
            <p className="product-card__sold-out">Sold out</p>
          ) : (
            <p className="product-card__footer-price">{formatPrice(price)}</p>
          )}
        </div>
      </Link>
    </article>
  );
}
