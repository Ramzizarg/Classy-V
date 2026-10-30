import { HomeClothesline } from "@/components/HomeClothesline";
import { HomeHero } from "@/components/HomeHero";
import { HomeTryTheLook } from "@/components/HomeTryTheLook";
import type { Product } from "@/lib/types";

/**
 * Home: fixed lifestyle hero, then a product sheet that scrolls up over it.
 * Fixed (vs sticky) keeps mobile scroll on the compositor — much smoother.
 */
export function HomeLookbook({ products }: { products: Product[] }) {
  return (
    <section className="home-drop-page">
      <div className="home-hero-fixed">
        <HomeHero />
      </div>
      <div className="home-hero-spacer" aria-hidden="true" />

      <div className="home-products">
        {/* Observed by SiteHeader — hides the bar once the sheet reaches it. */}
        <div className="home-header-sentinel" aria-hidden="true" />
        <HomeClothesline products={products} />
        <div className="home-products__inner">
          <HomeTryTheLook products={products} />
        </div>
      </div>
    </section>
  );
}
