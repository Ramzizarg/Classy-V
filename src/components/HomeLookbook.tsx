import Link from "next/link";
import { HomeHero } from "@/components/HomeHero";
import { LookbookCard } from "@/components/LookbookCard";
import type { Product } from "@/lib/types";

/**
 * Home: sticky lifestyle hero, then a product drop that scrolls up over it.
 */
export function HomeLookbook({ products }: { products: Product[] }) {
  const grid = products.slice(0, 16);

  return (
    <section className="home-drop-page">
      <div className="home-hero-sticky">
        <HomeHero />
      </div>

      <div className="home-products">
        <div className="home-products__inner">
          <header className="home-products__header">
            <h2 className="home-products__title">Latest drop</h2>
            <Link href="/collection" className="home-products__view-all">
              View all
            </Link>
          </header>

          {grid.length === 0 ? (
            <div className="home-products__empty">
              <p>No products yet.</p>
              <Link href="/collection" className="btn">
                Shop all products
              </Link>
            </div>
          ) : (
            <div className="home-products__grid">
              {grid.map((product, index) => (
                <LookbookCard key={product.id} product={product} priority={index < 2} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
