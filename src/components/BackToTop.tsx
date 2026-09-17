"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const SHOW_AFTER_PX = 480;

/** Minimal “back to top” control for long storefront pages. */
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
      setVisible(window.scrollY > SHOW_AFTER_PX);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
      ↑ Top
    </button>
  );
}
