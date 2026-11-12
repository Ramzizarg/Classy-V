"use client";

import { useEffect } from "react";
import { isInAppBrowser } from "@/lib/inAppBrowser";

function scroller() {
  return document.scrollingElement || document.documentElement;
}

function scrollY() {
  const el = scroller();
  return el.scrollTop || window.scrollY || document.body.scrollTop || 0;
}

function maxScroll() {
  const el = scroller();
  return el.scrollHeight - el.clientHeight;
}

function setScroll(y: number) {
  window.scrollTo(0, y);
  document.documentElement.scrollTop = y;
  document.body.scrollTop = y;
}

/**
 * Instagram's webview drops the first pan that leaves the exact top or bottom.
 * After each gesture ends, park 1px inside the range so the next pan — the
 * first scroll back up from the bottom — moves the page immediately.
 */
export function InAppScrollFix() {
  useEffect(() => {
    if (!isInAppBrowser()) return;

    document.documentElement.classList.add("in-app-browser");

    let touching = false;
    let nudging = false;
    let timer = 0;

    const nudge = () => {
      if (touching || nudging) return;
      if (document.body.style.overflow === "hidden") return;

      const max = maxScroll();
      if (max <= 2) return;
      const y = scrollY();
      /* 0.5px dead zone — subpixel scrollTop must not retrigger the nudge. */
      let next = -1;
      if (y < 0.5) next = 1;
      else if (y > max - 0.5) next = Math.max(1, max - 1);
      if (next < 0) return;

      nudging = true;
      setScroll(next);
      nudging = false;
    };

    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(nudge, 50);
    };

    const onStart = () => {
      touching = true;
      window.clearTimeout(timer);
    };
    const onEnd = () => {
      touching = false;
      later();
    };
    const onScroll = () => {
      if (touching || nudging) return;
      later();
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scrollend", nudge);
    window.addEventListener("pageshow", nudge);
    nudge();

    return () => {
      window.clearTimeout(timer);
      document.documentElement.classList.remove("in-app-browser");
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scrollend", nudge);
      window.removeEventListener("pageshow", nudge);
    };
  }, []);

  return null;
}
