"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Home only shows 9 lookbook tiles — keep this low so ↑ Top still appears. */
const SHOW_AFTER_PX = 220;

function scrollTop() {
  return (
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  );
}

/** Streetwear “back to top” — square chip, arrow + label. */
export function BackToTop() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  const hide =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname === "/checkout";

  useEffect(() => {
    if (hide) {
      setVisible(false);
      return;
    }

    const onScroll = () => {
      setVisible(scrollTop() > SHOW_AFTER_PX);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [hide, pathname]);

  if (hide || !visible) return null;

  return (
    <button
      type="button"
      className="back-to-top"
      aria-label="Back to top"
      onClick={() => {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      }}
    >
      <span className="back-to-top__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 19V5" strokeLinecap="square" />
          <path d="M5 12l7-7 7 7" strokeLinecap="square" strokeLinejoin="miter" />
        </svg>
      </span>
      <span className="back-to-top__label">Top</span>
    </button>
  );
}
