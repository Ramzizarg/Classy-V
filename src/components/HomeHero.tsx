import Image from "next/image";
import { SITE } from "@/lib/site";

/** Mobile-only hero frame. */
const MOBILE_SRC = "/images/exp_mobile_header_img.webp";
/** Desktop-only hero frame (replace file in /public to update; bump ?v= after replaces). */
const DESKTOP_SRC = "/images/Resized_August_header_image_2.webp?v=1920";

/**
 * Full-bleed home hero: mobile and desktop each get their own lifestyle frame.
 * Served unoptimized so Next does not recompress the WebPs.
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
          unoptimized
          sizes="100vw"
          className="home-hero__img home-hero__img--mobile"
        />
        <Image
          src={DESKTOP_SRC}
          alt=""
          aria-hidden
          fill
          priority
          unoptimized
          sizes="100vw"
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
