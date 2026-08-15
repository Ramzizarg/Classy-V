import Link from "next/link";
import type { CSSProperties } from "react";
import { SITE } from "@/lib/site";

const BRAND_MARK_SRC = "/brand/classy%20v%204.png";

/**
 * Painted sparkle lockup. Shipped as a pre-coloured PNG so the chalk texture and
 * yellow ink stay intact — including on hover (no white recolor).
 * `className` still accepts `h-*`/`w-*` overrides.
 */
export function BrandMark({
  width = 118,
  className,
  src = BRAND_MARK_SRC,
  href = "/",
  label,
}: {
  width?: number;
  className?: string;
  src?: string;
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label ?? `${SITE.name} home`}
      className="brand-link inline-block"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset; size via CSS var / utility classes */}
      <img
        src={src}
        alt=""
        aria-hidden
        style={{ "--brand-mark-width": `${width}px` } as CSSProperties}
        className={`brand-mark ${className ?? ""}`}
      />
    </Link>
  );
}
