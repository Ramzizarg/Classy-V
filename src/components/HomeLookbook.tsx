import Image from "next/image";
import Link from "next/link";
import { LookbookCard } from "@/components/LookbookCard";
import type { Product } from "@/lib/types";

/**
 * Home lookbook: illicitbloc-style dense portrait grid.
 * Mobile and desktop each open with a full-bleed hero, then the product grid.
 */
export function HomeLookbook({
  products,
  heroImage = "/images/home-hero-mobile.png",
  heroImageDesktop = "/images/unnamed.png",
  quote = "You are Special",
  brandLine = "Winter collection",
}: {
  products: Product[];
  heroImage?: string;
  heroImageDesktop?: string;
  quote?: string;
  brandLine?: string;
}) {
  const heroCopy = (
    <div className="lookbook-hero__foot">
      <h1 className="lookbook-hero__quote">{quote}</h1>
      <p className="lookbook-hero__brand">{brandLine}</p>
    </div>
  );

  return (
    <section className="lookbook">
      <div className="lookbook-hero lg:hidden">
        <Image
          src={heroImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="lookbook-hero__img"
        />
        <div className="lookbook-hero__shade" aria-hidden />
        {heroCopy}
      </div>

      <div className="lookbook-hero lookbook-hero--desktop hidden lg:block">
        <Image
          src={heroImageDesktop}
          alt=""
          fill
          priority
          sizes="100vw"
          className="lookbook-hero__img lookbook-hero__img--desktop"
        />
        <div className="lookbook-hero__shade" aria-hidden />
        {heroCopy}
      </div>

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
    </section>
  );
}
