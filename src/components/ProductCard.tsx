import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { effectivePrice, isSoldOut } from "@/lib/products";
import type { Product } from "@/lib/types";

export function ProductCard({
  product,
  priority = false,
  sizes = "(min-width: 1800px) 22vw, (min-width: 768px) 30vw, 46vw",
}: {
  product: Product;
  priority?: boolean;
  sizes?: string;
}) {
  const soldOut = isSoldOut(product);
  const price = effectivePrice(product);
  const onSale = price < product.price;

  return (
    <article className="product-card">
      <Link href={`/collection/${product.slug}`} className="block text-center">
        <div className="media-frame aspect-square w-full">
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
        </div>

        <h3 className="ui mt-4">
          {product.name}
        </h3>

        <p className="ui mt-2 text-price">
          {onSale ? (
            <>
              <span className="text-muted line-through">{formatPrice(product.price)}</span>{" "}
              <span>{formatPrice(price)}</span>
            </>
          ) : (
            formatPrice(price)
          )}
          {soldOut ? <span className="text-foreground"> — Sold Out</span> : null}
        </p>
      </Link>
    </article>
  );
}
