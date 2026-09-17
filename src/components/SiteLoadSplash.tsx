"use client";

import { useEffect, useState } from "react";
import { BRAND_LOGO_SRC } from "@/components/BrandMark";

/** Matches the `splash-cover` / `splash-mark` animations in globals.css. */
const SPLASH_MS = 1500;
const SEEN_KEY = "classyv:splash-seen";
const REPLAY_EVENT = "classyv:replay-splash";
const ENTRY_KEY = "classyv-entry-gate";

/**
 * Call this before navigating home so the splash replays as a transition.
 * It clears the session flag and fires a custom event that the already-mounted
 * `SiteLoadSplash` listens for.
 */
export function replaySplash() {
  try {
    sessionStorage.removeItem(SEEN_KEY);
  } catch {}
  window.dispatchEvent(new Event(REPLAY_EVENT));
}

/**
 * Black cover with the wordmark zoom animation. Plays once on the first visit,
 * then again whenever `replaySplash()` is called (e.g. clicking the header logo).
 *
 * Session flags are read only after mount so SSR HTML matches the first client paint.
 */
export function SiteLoadSplash() {
  const [ready, setReady] = useState(false);
  const [entryOk, setEntryOk] = useState(false);
  const [finished, setFinished] = useState(true);

  useEffect(() => {
    try {
      setEntryOk(sessionStorage.getItem(ENTRY_KEY) === "yes");
      setFinished(sessionStorage.getItem(SEEN_KEY) === "1");
    } catch {
      setEntryOk(false);
      setFinished(true);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    const handle = () => {
      setEntryOk(true);
      setFinished(false);
    };
    window.addEventListener(REPLAY_EVENT, handle);
    return () => window.removeEventListener(REPLAY_EVENT, handle);
  }, []);

  useEffect(() => {
    if (!ready || !entryOk || finished) return;
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {}
      setFinished(true);
    }, SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, [ready, entryOk, finished]);

  if (!ready || !entryOk || finished) return null;

  return (
    <div className="splash" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND_LOGO_SRC}
        alt=""
        fetchPriority="high"
        className="splash-mark"
      />
    </div>
  );
}
