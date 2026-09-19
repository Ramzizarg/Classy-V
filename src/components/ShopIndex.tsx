import Link from "next/link";
import { LookbookCard } from "@/components/LookbookCard";
import type { Product } from "@/lib/types";

/** Same lookbook grid as home — with the filter title and count above. */
export function ShopIndex({
  products,
  heading,
  note,
}: {
  products: Product[];
  heading?: string;
  note?: string;
}) {
  return (
    <section className="lookbook">
      <div className="lookbook-hero">
        <div className="lookbook__shop">
          {heading || note ? (
            <div className="lookbook__header">
              {heading ? <h1 className="lookbook__title">{heading}</h1> : null}
              {note ? <p className="lookbook__all">{note}</p> : null}
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
