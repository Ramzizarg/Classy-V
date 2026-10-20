import Image from "next/image";
import { SITE } from "@/lib/site";

/** Mobile-only hero frame (3:4). */
const MOBILE_SRC = "/images/hero-mobile.jpg";
/** Desktop-only hero frame (16:9). */
const DESKTOP_SRC = "/images/hero-desktop.jpg";

/**
 * Full-bleed home hero: mobile and desktop each get their own lifestyle frame.
 * Served unoptimized so the original files are not re-encoded.
 */
export function HomeHero() {
  return (
    <div className="home-hero">
      <div className="home-hero__media">
        {/* Mobile LCP — skip download on desktop via sizes. */}
        <Image
          src={MOBILE_SRC}
          alt={`${SITE.name} look`}
          fill
          priority
          fetchPriority="high"
          quality={100}
          unoptimized
          sizes="(min-width: 768px) 1px, 100vw"
          className="home-hero__img home-hero__img--mobile"
        />
        {/* Desktop — not priority on mobile so Lighthouse mobile isn’t fighting two heros. */}
        <Image
          src={DESKTOP_SRC}
          alt=""
          aria-hidden
          fill
          quality={100}
          unoptimized
          sizes="(max-width: 767px) 1px, 100vw"
          className="home-hero__img home-hero__img--desktop"
        />
      </div>

      <div className="home-hero__shade" aria-hidden="true" />

      <div className="home-hero__copy">
        <p className="home-hero__eyebrow">New drop: live now</p>
        <h1 className="home-hero__title">{SITE.tagline}</h1>
      </div>
    </div>
  );
}
