"use client";

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BRAND_LOGO_SRC } from "@/components/BrandMark";

/** Matches the `splash-cover` / `splash-mark` animations in globals.css. */
const SPLASH_MS = 1500;
/** Unhide the page when the cover starts fading — no extra black hold. */
const REVEAL_MS = Math.round(SPLASH_MS * 0.68);
const REPLAY_EVENT = "classyv:replay-splash";
const ENTRY_KEY = "classyv-entry-gate";

function setSplashLock(on: boolean) {
  const html = document.documentElement;
  if (on) html.setAttribute("data-splash-on", "1");
  else html.removeAttribute("data-splash-on");
}

function setSplashReveal(on: boolean) {
  const html = document.documentElement;
  if (on) html.setAttribute("data-splash-reveal", "1");
  else html.removeAttribute("data-splash-reveal");
}

function fitSplashCover() {
  const vv = window.visualViewport;
  const height = Math.ceil(
    Math.max(
      window.innerHeight || 0,
      document.documentElement.clientHeight || 0,
      vv ? vv.height + Math.abs(vv.offsetTop || 0) : 0,
    ) + 240,
  );
  document.documentElement.style.setProperty("--splash-cover-h", `${height}px`);
}

function clearBootSplash() {
  document.documentElement.removeAttribute("data-boot-splash");
  document.documentElement.style.removeProperty("--splash-cover-h");
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
  const allowed = shouldShowSplash(pathname);

  const [ready, setReady] = useState(false);
  const [entryOk, setEntryOk] = useState(false);
  const [playId, setPlayId] = useState(0);
  const [visible, setVisible] = useState(false);

  const bootPlayed = useRef(false);
  /** First visit: skip splash once the entry gate (yes/no) just finished. */
  const skipBootAfterGate = useRef(false);
  const splashActive = useRef(false);
  const hideTimer = useRef<number | null>(null);
  const revealTimer = useRef<number | null>(null);

  const clearTimers = () => {
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (revealTimer.current != null) {
      window.clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
  };

  const finishSplash = () => {
    splashActive.current = false;
    setVisible(false);
    setSplashLock(false);
    setSplashReveal(false);
    clearBootSplash();
    hideTimer.current = null;
    revealTimer.current = null;
  };

  const startTimers = () => {
    clearTimers();
    setSplashReveal(false);
    revealTimer.current = window.setTimeout(() => {
      setSplashReveal(true);
      revealTimer.current = null;
    }, REVEAL_MS);
    hideTimer.current = window.setTimeout(finishSplash, SPLASH_MS);
  };

  const beginSplash = () => {
    clearBootSplash();
    splashActive.current = true;
    setSplashLock(true);
    setPlayId((id) => id + 1);
    setVisible(true);
    fitSplashCover();
    startTimers();
  };

  useEffect(() => {
    let alreadyPassed = false;
    try {
      const saved = localStorage.getItem(ENTRY_KEY);
      alreadyPassed = saved === "yes" || sessionStorage.getItem(ENTRY_KEY) === "yes";
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

  /* Boot / hard reload only — never block in-app navigation. */
  useLayoutEffect(() => {
    if (!ready || !entryOk) return;

    if (!allowed) {
      clearTimers();
      finishSplash();
      return;
    }

    if (bootPlayed.current) return;
    bootPlayed.current = true;

    if (skipBootAfterGate.current) {
      skipBootAfterGate.current = false;
      setSplashLock(false);
      setSplashReveal(false);
      clearBootSplash();
      return;
    }

    fitSplashCover();

    /* Refresh / return visit: native boot splash already covering — don't restart. */
    if (document.documentElement.getAttribute("data-boot-splash") === "1") {
      splashActive.current = true;
      startTimers();
      return;
    }

    beginSplash();
  }, [ready, entryOk, allowed]);

  useEffect(
    () => () => {
      clearTimers();
      setSplashLock(false);
      setSplashReveal(false);
    },
    [],
  );

  useEffect(() => {
    const active = visible || document.documentElement.getAttribute("data-boot-splash") === "1";
    if (!active) return;

    fitSplashCover();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", fitSplashCover);
    vv?.addEventListener("scroll", fitSplashCover);
    window.addEventListener("resize", fitSplashCover);

    const html = document.documentElement;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyTouch = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
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
      vv?.removeEventListener("resize", fitSplashCover);
      vv?.removeEventListener("scroll", fitSplashCover);
      window.removeEventListener("resize", fitSplashCover);
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
