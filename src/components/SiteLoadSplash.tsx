"use client";

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { BRAND_LOGO_SRC } from "@/components/BrandMark";

/** Matches the `splash-cover` / `splash-mark` animations in globals.css. */
const SPLASH_MS = 1500;
const REPLAY_EVENT = "classyv:replay-splash";
const ENTRY_KEY = "classyv-entry-gate";

function clearBootSplash() {
  document.documentElement.removeAttribute("data-boot-splash");
  const boot = document.getElementById("boot-splash");
  if (boot?.getAttribute("data-source") === "boot") boot.remove();
}

function shouldShowSplash(pathname: string) {
  if (pathname.startsWith("/dashboard")) return false;
  if (pathname.startsWith("/admin")) return false;
  if (pathname.startsWith("/login")) return false;
  if (pathname.startsWith("/api")) return false;
  return true;
}

/** Call from logo clicks on home — replays the splash without navigating. */
export function replaySplash() {
  window.dispatchEvent(new Event(REPLAY_EVENT));
}

function SiteLoadSplashInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locationKey = `${pathname}?${searchParams.toString()}`;
  const allowed = shouldShowSplash(pathname);

  const [ready, setReady] = useState(false);
  const [entryOk, setEntryOk] = useState(false);
  const [playId, setPlayId] = useState(0);
  const [visible, setVisible] = useState(false);

  const lastLocation = useRef<string | null>(null);
  const bootPlayed = useRef(false);
  /** First visit: skip splash once the entry gate (yes/no) just finished. */
  const skipBootAfterGate = useRef(false);
  const splashActive = useRef(false);
  const splashUntil = useRef(0);
  const hideTimer = useRef<number | null>(null);

  const clearHideTimer = () => {
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const beginSplash = () => {
    const now = Date.now();
    /* Already covering from the click — don't restart when the route commits. */
    if (splashActive.current && now < splashUntil.current - 80) {
      return;
    }
    clearBootSplash();
    splashActive.current = true;
    splashUntil.current = now + SPLASH_MS;
    setPlayId((id) => id + 1);
    setVisible(true);
    clearHideTimer();
    hideTimer.current = window.setTimeout(() => {
      splashActive.current = false;
      setVisible(false);
      hideTimer.current = null;
    }, SPLASH_MS);
  };

  useEffect(() => {
    let alreadyPassed = false;
    try {
      alreadyPassed = sessionStorage.getItem(ENTRY_KEY) === "yes";
    } catch {
      alreadyPassed = false;
    }
    if (document.documentElement.getAttribute("data-entry-ok") === "1") {
      alreadyPassed = true;
    }
    /* Gate still ahead — after Yes/No, don't play the boot splash. */
    if (!alreadyPassed) {
      skipBootAfterGate.current = true;
    }
    setEntryOk(alreadyPassed);
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

  /* Cover the screen on link click — before the next page paints. */
  useEffect(() => {
    if (!ready || !entryOk) return;

    const onClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (!shouldShowSplash(url.pathname)) return;

      const nextKey = `${url.pathname}?${url.searchParams.toString()}`;
      const here = `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`;
      if (nextKey === here) return;

      beginSplash();
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [ready, entryOk]);

  useEffect(() => {
    const handle = () => {
      setEntryOk(true);
      if (window.location.pathname === "/") {
        beginSplash();
      }
    };
    window.addEventListener(REPLAY_EVENT, handle);
    return () => window.removeEventListener(REPLAY_EVENT, handle);
  }, []);

  /* Reload / first entry, and history back-forward (before paint). */
  useLayoutEffect(() => {
    if (!ready || !entryOk) return;

    if (!allowed) {
      clearHideTimer();
      splashActive.current = false;
      setVisible(false);
      lastLocation.current = locationKey;
      clearBootSplash();
      return;
    }

    const pathChanged = lastLocation.current !== null && lastLocation.current !== locationKey;
    const firstBoot = !bootPlayed.current;
    lastLocation.current = locationKey;

    if (firstBoot || pathChanged) {
      bootPlayed.current = true;
      if (firstBoot && skipBootAfterGate.current) {
        skipBootAfterGate.current = false;
        clearBootSplash();
        return;
      }

      /* Refresh / return visit: native #boot-splash already animating — don't restart. */
      if (firstBoot && document.documentElement.getAttribute("data-boot-splash") === "1") {
        splashActive.current = true;
        splashUntil.current = Date.now() + SPLASH_MS;
        clearHideTimer();
        hideTimer.current = window.setTimeout(() => {
          splashActive.current = false;
          clearBootSplash();
          hideTimer.current = null;
        }, SPLASH_MS);
        return;
      }

      beginSplash();
    }
  }, [ready, entryOk, allowed, locationKey]);

  useEffect(() => () => clearHideTimer(), []);

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

  if (!visible) return null;

  return (
    <div key={playId} className="splash" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BRAND_LOGO_SRC} alt="" fetchPriority="high" className="splash-mark" />
    </div>
  );
}

export function SiteLoadSplash() {
  return (
    <Suspense fallback={null}>
      <SiteLoadSplashInner />
    </Suspense>
  );
}
