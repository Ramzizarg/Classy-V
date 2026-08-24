import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@/lib/types";

/** Dense product index: the grid alone, since the rail lives in the layout. */
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
    <div className="px-3 pt-2 pb-6 sm:px-5 lg:pl-20 lg:pr-48 lg:pt-6 xl:pl-28 xl:pr-72">
      {heading || note ? (
        <div className="mb-7 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {heading ? <h1 className="page-title">{heading}</h1> : null}
          {note ? <p className="ui-sm text-muted">{note}</p> : null}
        </div>
      ) : null}

      {products.length === 0 ? (
        <div className="flex flex-col items-start gap-4 py-10">
          <p className="ui">{heading ? "No products match." : "No products yet."}</p>
          {heading ? (
            <Link href="/collection" className="btn">
              Shop all products
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="product-grid">
          {products.map((product, index) => (
            <ProductCard key={product.id} product={product} priority={index < 4} />
          ))}
        </div>
      )}
    </div>
  );
}
