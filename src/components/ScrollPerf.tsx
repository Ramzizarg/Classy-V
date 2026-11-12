"use client";

import { useEffect } from "react";

/**
 * Marks the document while the user is scrolling so CSS can pause
 * expensive animations/filters and skip hit-testing on product grids.
 */
export function ScrollPerf() {
  useEffect(() => {
    const root = document.documentElement;
    let timer = 0;

    const endScroll = () => {
      timer = 0;
      root.classList.remove("is-scrolling");
    };

    /* Only real page scroll counts — sideways swipes on carousels must not flag it. */
    const onScroll = () => {
      if (!root.classList.contains("is-scrolling")) {
        root.classList.add("is-scrolling");
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(endScroll, 180);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
      root.classList.remove("is-scrolling");
    };
  }, []);

  return null;
}
