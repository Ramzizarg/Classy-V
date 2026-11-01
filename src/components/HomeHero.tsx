import Image from "next/image";
import { SITE } from "@/lib/site";

/** Mobile-only hero frame (3:4) — already compressed WebP (~133KB vs 4.2MB JPEG). */
const MOBILE_SRC = "/images/hero-mobile.webp";
/** Desktop-only hero frame (16:9). */
const DESKTOP_SRC = "/images/hero-desktop-hq.webp";

/**
 * Full-bleed home hero: mobile and desktop each get their own lifestyle frame.
 * Only the on-screen frame is high-priority so phones do not preload the desktop file.
 */
export function HomeHero() {
  return (
    <div className="home-hero">
      <div className="home-hero__media">
        <Image
          src={MOBILE_SRC}
          alt={`${SITE.name} look`}
          fill
          priority
          fetchPriority="high"
          sizes="(min-width: 768px) 1px, 100vw"
          className="home-hero__img home-hero__img--mobile"
        />
        <Image
          src={DESKTOP_SRC}
          alt=""
          aria-hidden
          fill
          loading="lazy"
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
