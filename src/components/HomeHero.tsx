import Image from "next/image";
import { SITE } from "@/lib/site";

/** Mobile-only hero frame. */
const MOBILE_SRC = "/images/exp_mobile_header_img.webp";
/** Desktop-only hero frame (replace file in /public to update). */
const DESKTOP_SRC = "/images/Resized_August_header_image_2.webp";

/**
 * Full-bleed home hero: mobile and desktop each get their own lifestyle frame.
 * Next Image optimizes to AVIF/WebP at the right size (LCP).
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
          quality={100}
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
