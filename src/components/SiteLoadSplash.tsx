"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BRAND_LOGO_SRC } from "@/components/BrandMark";

/** Matches the `splash-cover` / `splash-mark` animations in globals.css. */
const SPLASH_MS = 1500;
const REPLAY_EVENT = "classyv:replay-splash";
const ENTRY_KEY = "classyv-entry-gate";

/** Call from logo clicks that return home — replays only once `/` is active. */
export function replaySplash() {
  window.dispatchEvent(new Event(REPLAY_EVENT));
}

/**
 * Logo splash animation — home page only, all devices.
 */
export function SiteLoadSplash() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [ready, setReady] = useState(false);
  const [entryOk, setEntryOk] = useState(false);
  const [playId, setPlayId] = useState(0);
  const [visible, setVisible] = useState(false);
  const pendingReplay = useRef(false);
  const wasHome = useRef(false);

  useEffect(() => {
    try {
      setEntryOk(sessionStorage.getItem(ENTRY_KEY) === "yes");
    } catch {
      setEntryOk(false);
    }
    if (document.documentElement.getAttribute("data-entry-ok") === "1") {
      setEntryOk(true);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (entryOk) return;
    const sync = () => {
      if (document.documentElement.getAttribute("data-entry-ok") === "1") {
        setEntryOk(true);
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-entry-ok"],
    });
    return () => observer.disconnect();
  }, [entryOk]);

  useEffect(() => {
    const handle = () => {
      setEntryOk(true);
      if (pathname === "/") {
        setPlayId((id) => id + 1);
      } else {
        pendingReplay.current = true;
      }
    };
    window.addEventListener(REPLAY_EVENT, handle);
    return () => window.removeEventListener(REPLAY_EVENT, handle);
  }, [pathname]);

  useEffect(() => {
    if (!ready || !entryOk) return;

    if (!isHome) {
      wasHome.current = false;
      setVisible(false);
      return;
    }

    const arriving = !wasHome.current;
    wasHome.current = true;

    if (arriving || pendingReplay.current) {
      pendingReplay.current = false;
      setPlayId((id) => id + 1);
    }
  }, [ready, entryOk, isHome]);

  useEffect(() => {
    if (playId === 0 || !isHome) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, [playId, isHome]);

  useEffect(() => {
    if (!visible) return;

    const html = document.documentElement;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyTouch = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    const blockScroll = (event: Event) => {
      event.preventDefault();
    };
    document.addEventListener("touchmove", blockScroll, { passive: false });
    document.addEventListener("wheel", blockScroll, { passive: false });

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      html.style.overflow = previousHtmlOverflow;
      document.body.style.touchAction = previousBodyTouch;
      document.removeEventListener("touchmove", blockScroll);
      document.removeEventListener("wheel", blockScroll);
    };
  }, [visible]);

  if (!visible || !isHome) return null;

  return (
    <div key={playId} className="splash" aria-hidden>
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
