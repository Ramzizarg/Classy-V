import Link from "next/link";
import { LookbookCard } from "@/components/LookbookCard";
import type { Product } from "@/lib/types";

/**
 * Home lookbook: Corteiz-style black/yellow type + product grid in one section.
 */
export function HomeLookbook({ products }: { products: Product[] }) {
  return (
    <section className="lookbook">
      <div className="lookbook-hero">
        <div className="lookbook__shop">
          {products.length === 0 ? (
            <div className="lookbook__empty">
              <p>No products yet.</p>
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
