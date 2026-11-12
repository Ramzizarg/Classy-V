import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/lib/site";

/** Mobile-only hero frame (3:4) — already compressed WebP (~133KB vs 4.2MB JPEG). */
const MOBILE_SRC = "/images/hero-mobile.webp";
/** Desktop split — left panel (duo look). */
const DESKTOP_LEFT_SRC = "/images/MMS03446.jpg";
/** Desktop split — right panel (solo look). */
const DESKTOP_RIGHT_SRC = "/images/MMS03539.jpg";

/**
 * Full-bleed home hero.
 * Mobile: single lifestyle frame.
 * Desktop: Represent-style dual panels with CTAs; products sheet still scrolls over it.
 */
export function HomeHero() {
  return (
    <div className="home-hero">
      {/* Mobile: one full-bleed frame */}
      <div className="home-hero__media home-hero__media--mobile">
        <Image
          src={MOBILE_SRC}
          alt={`${SITE.name} look`}
          fill
          priority
          fetchPriority="high"
          sizes="(min-width: 768px) 1px, 100vw"
          className="home-hero__img"
        />
        <div className="home-hero__shade" aria-hidden="true" />
        <div className="home-hero__copy">
          <p className="home-hero__eyebrow">New drop: live now</p>
          <h1 className="home-hero__title">{SITE.tagline}</h1>
        </div>
      </div>

      {/* Desktop: two campaign panels */}
      <div className="home-hero__split" aria-label="Featured drops">
        <article className="home-hero__panel home-hero__panel--left">
          <div className="home-hero__panel-media">
            <Image
              src={DESKTOP_LEFT_SRC}
              alt={`${SITE.name} streetwear`}
              fill
              priority
              fetchPriority="high"
              sizes="(max-width: 767px) 1px, 50vw"
              className="home-hero__img home-hero__img--left"
            />
          </div>
          <div className="home-hero__shade home-hero__shade--panel" aria-hidden="true" />
          <div className="home-hero__panel-copy">
            <p className="home-hero__eyebrow">{SITE.description.replace(/\.$/, "")}</p>
            <h2 className="home-hero__panel-title">{SITE.name}</h2>
            <div className="home-hero__actions">
              <Link href="/collection" className="home-hero__btn home-hero__btn--solid">
                Shop now
              </Link>
              <Link href="/collection" className="home-hero__btn home-hero__btn--ghost">
                New collection
              </Link>
            </div>
          </div>
        </article>

        <article className="home-hero__panel home-hero__panel--right">
          <div className="home-hero__panel-media">
            <Image
              src={DESKTOP_RIGHT_SRC}
              alt={`${SITE.name} new collection`}
              fill
              sizes="(max-width: 767px) 1px, 50vw"
              className="home-hero__img home-hero__img--right"
            />
          </div>
          <div className="home-hero__shade home-hero__shade--panel" aria-hidden="true" />
          <div className="home-hero__panel-copy">
            <p className="home-hero__eyebrow">On a mission</p>
            <h2 className="home-hero__panel-title">{SITE.tagline} Streetwear</h2>
            <div className="home-hero__actions">
              <Link href="/collection" className="home-hero__btn home-hero__btn--ghost">
                Shop now
              </Link>
              <Link href="/collection?sort=newest" className="home-hero__btn home-hero__btn--ghost">
                Live drop
              </Link>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
