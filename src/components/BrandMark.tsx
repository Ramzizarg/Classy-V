import Link from "next/link";
import type { CSSProperties } from "react";
import { SITE } from "@/lib/site";

const BRAND_MARK_SRC = "/brand/classy-v-4.png";

/**
 * Sparkle lockup tinted with `--brand-ink`. A hidden `<img>` sets the box size
 * (reliable on mobile Safari); the coloured layer uses the PNG as a mask.
 * `className` still accepts `h-*`/`w-*` overrides on the sizing image.
 */
export function BrandMark({
  width = 118,
  className,
  src = BRAND_MARK_SRC,
  href = "/",
  label,
  onClick,
}: {
  width?: number;
  className?: string;
  src?: string;
  href?: string;
  label?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={label ?? `${SITE.name} home`}
      className="brand-link inline-block"
    >
      <span
        className="brand-mark-shell"
        style={
          {
            "--brand-mark-width": `${width}px`,
            "--brand-mark-image": `url("${src}")`,
          } as CSSProperties
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- sizes the shell; colour comes from the tint layer */}
        <img src={src} alt="" aria-hidden className={`brand-mark-size ${className ?? ""}`} />
        <span className="brand-mark-tint" aria-hidden />
      </span>
    </Link>
  );
}
