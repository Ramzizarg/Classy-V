"use client";

import { useEffect, useState } from "react";

/** Matches the `splash-cover` / `splash-mark` animations in globals.css. */
const SPLASH_MS = 1500;

/**
 * Black cover played on every full page load: the wordmark zooms in, holds, then
 * zooms back out as the cover clears. The animation is pure CSS so it is already
 * running before React hydrates; this component only drops it from the DOM after.
 */
export function SiteLoadSplash() {
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setFinished(true), SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, []);

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
