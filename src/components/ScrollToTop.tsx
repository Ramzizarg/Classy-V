"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const POSITIONS_KEY = "classyv.scroll.v1";

function pageKey() {
  return `${window.location.pathname}${window.location.search}`;
}

function readPositions(): Record<string, number> {
  try {
    return JSON.parse(window.sessionStorage.getItem(POSITIONS_KEY) || "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function savePosition(key: string, y: number) {
  try {
    const positions = readPositions();
    positions[key] = Math.round(y);
    const keys = Object.keys(positions);
    if (keys.length > 40) delete positions[keys[0]!];
    window.sessionStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Read at popstate, before the new page renders: a shorter page clamping the scroll
 * would otherwise overwrite the saved spot first.
 */
let historyTarget: number | undefined;
/**
 * The App Router swaps the page before it updates the URL, so scroll events in
 * between would be saved under the old page. Saving pauses from tap/Back until the
 * new route has settled.
 */
let navigating = false;

/**
 * New pages open at the top; Back / Forward returns to where the shopper was
 * (grid position after viewing a product, including in in-app browsers).
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    let frame = 0;
    const onScroll = () => {
      if (frame || navigating) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!navigating) savePosition(pageKey(), window.scrollY);
      });
    };
    const onPop = () => {
      navigating = true;
      historyTarget = readPositions()[pageKey()] ?? 0;
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") return;
      if (link.origin !== window.location.origin) return;
      if (`${link.pathname}${link.search}` === pageKey()) return;
      savePosition(pageKey(), window.scrollY);
      navigating = true;
      // A link whose navigation was cancelled must not freeze saving for good.
      window.setTimeout(() => {
        navigating = false;
      }, 4000);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onPop);
    document.addEventListener("click", onClick, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  useEffect(() => {
    const target = historyTarget;
    historyTarget = undefined;
    const settle = window.setTimeout(() => {
      navigating = false;
    }, target ? 1000 : 50);
    if (!target) {
      /* Instant jump on route change — never animate from mid-page. */
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      return () => window.clearTimeout(settle);
    }
    // Content (images, client lists) may still be growing; retry until the page is tall enough.
    const timers = [0, 80, 200, 450, 900].map((delay) =>
      window.setTimeout(() => {
        if (Math.abs(window.scrollY - target) > 4) {
          window.scrollTo({ top: target, left: 0, behavior: "instant" });
        }
      }, delay),
    );
    const cancel = () => timers.forEach((timer) => window.clearTimeout(timer));
    // The shopper taking over the scroll wins over the remaining retries.
    window.addEventListener("touchstart", cancel, { once: true, passive: true });
    window.addEventListener("wheel", cancel, { once: true, passive: true });
    return () => {
      cancel();
      window.clearTimeout(settle);
      navigating = false;
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("wheel", cancel);
    };
  }, [pathname]);

  return null;
}
