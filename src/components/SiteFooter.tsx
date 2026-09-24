"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BrandMark, BRAND_MARK_FOOTER_SRC } from "@/components/BrandMark";
import { InstagramGlyph } from "@/components/SocialGlyphs";
import { SITE } from "@/lib/site";

const HELP_LINKS = [
  { href: "/about", label: "Archive" },
  { href: "/contact", label: "Newsletter" },
  { href: "/shipping-returns", label: "Shipping policy" },
  { href: "/legal/terms", label: "Terms of service" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/track", label: "Track order" },
] as const;

export function SiteFooter() {
  const year = new Date().getFullYear();
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (helpOpen) root.setAttribute("data-footer-help", "open");
    else root.removeAttribute("data-footer-help");
    return () => root.removeAttribute("data-footer-help");
  }, [helpOpen]);

  useEffect(() => {
    if (!helpOpen) return;

    const onPointer = (event: MouseEvent) => {
      if (!helpRef.current?.contains(event.target as Node)) {
        setHelpOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHelpOpen(false);
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [helpOpen]);

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <BrandMark
            width={120}
            className="site-footer__logo h-9 w-auto sm:h-10 lg:h-11"
            src={BRAND_MARK_FOOTER_SRC}
          />
          <p className="site-footer__copy">
            Copyright © {year}, {SITE.legalName}.
          </p>
        </div>
      </div>

      <a
        href={SITE.instagram}
        target="_blank"
        rel="noreferrer"
        aria-label="Instagram"
        className="site-footer__social-link"
      >
        <InstagramGlyph className="h-5 w-5" />
      </a>

      <div className="site-footer__help" ref={helpRef}>
        {helpOpen ? (
          <nav id="footer-help-panel" className="site-footer__help-panel" aria-label="Help">
            {HELP_LINKS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="site-footer__help-link"
                onClick={() => setHelpOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
        <button
          type="button"
          className="site-footer__help-btn"
          aria-expanded={helpOpen}
          aria-controls="footer-help-panel"
          onClick={() => setHelpOpen((open) => !open)}
        >
          Need Help ?
        </button>
      </div>
    </footer>
  );
}
