import Link from "next/link";
import { LookbookCard } from "@/components/LookbookCard";
import type { Product } from "@/lib/types";

/** Same lookbook grid as home — with the filter title and count above. */
export function ShopIndex({
  products,
  heading,
  note,
  count,
}: {
  products: Product[];
  heading?: string;
  note?: string;
  /** Rendered as a badge with the number emphasised; takes precedence over `note`. */
  count?: number;
}) {
  return (
    <section className="lookbook">
      <div className="lookbook-hero">
        <div className="lookbook__shop">
          {heading || note || count !== undefined ? (
            <div className="lookbook__header">
              <div className="lookbook__heading">
                <p className="lookbook__eyebrow">Shop</p>
                {heading ? <h1 className="lookbook__title">{heading}</h1> : null}
              </div>
              {count !== undefined ? (
                <p className="lookbook__all" aria-label={`${count} ${count === 1 ? "product" : "products"}`}>
                  <span className="lookbook__count">{count}</span>
                  {count === 1 ? "Product" : "Products"}
                </p>
              ) : note ? (
                <p className="lookbook__all">{note}</p>
              ) : null}
            </div>
          ) : null}

          {products.length === 0 ? (
            <div className="lookbook__empty">
              <p>No products match.</p>
              <Link href="/collection" className="btn">
                Shop all products
              </Link>
            </div>
          ) : (
            <div className="lookbook__grid">
              {products.map((product, index) => (
                <LookbookCard key={product.id} product={product} priority={index < 4} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
