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
    let framed = false;

    const endScroll = () => {
      timer = 0;
      root.classList.remove("is-scrolling");
    };

    const onScroll = () => {
      if (!root.classList.contains("is-scrolling")) {
        root.classList.add("is-scrolling");
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(endScroll, 180);
    };

    /* Also catch touch momentum on iOS where scroll events can throttle. */
    const onTouchMove = () => {
      if (framed) return;
      framed = true;
      window.requestAnimationFrame(() => {
        framed = false;
        onScroll();
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchmove", onTouchMove);
      window.clearTimeout(timer);
      root.classList.remove("is-scrolling");
    };
  }, []);

  return null;
}
