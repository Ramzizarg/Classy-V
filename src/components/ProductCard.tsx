import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { effectivePrice, getCategory, isSoldOut } from "@/lib/products";
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
  const soldOut = isSoldOut(product);
  const price = effectivePrice(product);
  const category = getCategory(product.categorySlug);

  return (
    <article className="product-card product-card--catalog">
      <Link href={`/collection/${product.slug}`} className="flex h-full flex-col">
        <div className="product-card__header">
          <span className="product-card__header-category">{category?.name ?? "Product"}</span>
        </div>

        <div className="product-card__body flex-1">
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
          </div>

          <div className="product-card__copy">
            <h3 className="product-card__title">{product.name}</h3>

            {product.shortDescription ? (
              <p className="product-card__desc line-clamp-2">{product.shortDescription}</p>
            ) : null}
          </div>
        </div>

        <div className="product-card__footer">
          <span>{soldOut ? "Sold out" : "In stock"}</span>
          <span className="product-card__footer-price">{formatPrice(price)}</span>
        </div>
      </Link>
    </article>
  );
}
