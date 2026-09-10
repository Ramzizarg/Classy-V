import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { InstagramGlyph } from "@/components/SocialGlyphs";
import { INFO_NAV, SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <nav className="site-footer__nav" aria-label="Footer">
          {INFO_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="site-footer__link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="site-footer__brand">
          <BrandMark width={92} className="h-9 w-auto" />
          <div className="site-footer__social">
            <a
              href={SITE.instagram}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="site-footer__social-link"
            >
              <InstagramGlyph className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
