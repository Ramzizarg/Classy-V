"use client";

import { useEffect, useState } from "react";

/** Matches the `splash-cover` / `splash-mark` animations in globals.css. */
const SPLASH_MS = 1500;
const SEEN_KEY = "classyv:splash-seen";

/**
 * Black cover with the wordmark zoom animation. Plays only once per browser
 * session — navigating between pages afterwards skips it entirely.
 */
export function SiteLoadSplash() {
  const [finished, setFinished] = useState(() => {
    try {
      return sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (finished) return;
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {}
      setFinished(true);
    }, SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, [finished]);

  if (finished) return null;

  return (
    <div className="splash" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/classy-v-splash.png"
        alt=""
        fetchPriority="high"
        className="splash-mark"
      />
    </div>
  );
}
