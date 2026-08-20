import Link from "next/link";
import type { CSSProperties } from "react";
import { SITE } from "@/lib/site";

const BRAND_MARK_SRC = "/brand/classy%20v%204.png";

/**
 * Sparkle lockup. The PNG is used as a CSS mask so `--brand-ink` tints the shape.
 * `className` still accepts `h-*`/`w-*` overrides.
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
        aria-hidden
        style={
          {
            "--brand-mark-width": `${width}px`,
            "--brand-mark-image": `url("${src}")`,
          } as CSSProperties
        }
        className={`brand-mark ${className ?? ""}`}
      />
    </Link>
  );
}
