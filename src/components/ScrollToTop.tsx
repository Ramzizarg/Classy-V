"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Always land at the top on first open and on every route change. */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    /* Instant jump on route change — never animate from mid-page. */
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
