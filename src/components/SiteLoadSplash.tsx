"use client";

import { useEffect, useState } from "react";

/** Matches the `splash-cover` / `splash-mark` animations in globals.css. */
const SPLASH_MS = 1500;
const SEEN_KEY = "classyv:splash-seen";
const REPLAY_EVENT = "classyv:replay-splash";

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
 */
export function SiteLoadSplash() {
  const [entryOk, setEntryOk] = useState(() => {
    try {
      return sessionStorage.getItem("classyv-entry-gate") === "yes";
    } catch {
      return false;
    }
  });
  const [finished, setFinished] = useState(() => {
    try {
      return sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const handle = () => {
      setEntryOk(true);
      setFinished(false);
    };
    window.addEventListener(REPLAY_EVENT, handle);
    return () => window.removeEventListener(REPLAY_EVENT, handle);
  }, []);

  useEffect(() => {
    if (!entryOk || finished) return;
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {}
      setFinished(true);
    }, SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, [entryOk, finished]);

  if (!entryOk || finished) return null;

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
