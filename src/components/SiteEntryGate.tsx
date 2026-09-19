"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { SITE } from "@/lib/site";
import { BRAND_LOGO_SRC } from "@/components/BrandMark";

/** Welcome text holds, then the curtain split plays. */
const WELCOME_MS = 1400;
/** Duration of the curtain-open animation before unmounting. */
const OPEN_MS = 900;
const STORAGE_KEY = "classyv-entry-gate";

type GateChoice = "yes" | "no";
type GatePhase = "idle" | "question" | "welcome" | "opening" | "rejected";

function isExemptPath(path: string | null): boolean {
  if (!path) return true;
  return /^\/(dashboard|admin|api|backoffice|login)(\/|$)/i.test(path);
}

function readChoice(): GateChoice | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    return value === "yes" || value === "no" ? value : null;
  } catch {
    return null;
  }
}

function writeChoice(choice: GateChoice) {
  try {
    sessionStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Private browsing can block storage; the gate still works for this page view.
  }
}

function markEntryPassed() {
  document.documentElement.setAttribute("data-entry-ok", "1");
}

function subscribeToEntryGate() {
  return () => {};
}

export function SiteEntryGate() {
  const pathname = usePathname();
  const exempt = isExemptPath(pathname);

  const mounted = useSyncExternalStore(subscribeToEntryGate, () => true, () => false);
  const storedChoice = useSyncExternalStore(subscribeToEntryGate, readChoice, () => null);
  const [phase, setPhase] = useState<GatePhase>("question");

  useEffect(() => {
    if (exempt || storedChoice === "yes") markEntryPassed();
  }, [exempt, storedChoice]);

  useEffect(() => {
    if (phase !== "welcome") return;

    const timer = window.setTimeout(() => setPhase("opening"), WELCOME_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "opening") return;

    markEntryPassed();
    const timer = window.setTimeout(() => {
      writeChoice("yes");
      setPhase("idle");
    }, OPEN_MS);

    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (exempt || storedChoice === "yes") return;
    if (phase === "idle" && storedChoice !== "no") return;

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
  }, [exempt, phase, storedChoice]);

  const accept = useCallback(() => {
    setPhase("welcome");
  }, []);

  const reject = useCallback(() => {
    writeChoice("no");
    setPhase("rejected");
  }, []);

  const reconsider = useCallback(() => {
    setPhase("welcome");
  }, []);

  if (exempt || !mounted || storedChoice === "yes") return null;

  const visiblePhase: GatePhase | null =
    storedChoice === "no" ? "rejected" : phase === "idle" ? null : phase;

  if (!visiblePhase) return null;
  if (typeof document === "undefined") return null;

  const opening = visiblePhase === "opening" || phase === "opening";

  return createPortal(
    <div
      className={`entry-gate fixed inset-0 z-[9990] overflow-hidden overscroll-none ${opening ? "pointer-events-none" : "bg-black"}`}
      role="dialog"
      aria-modal
      aria-labelledby="entry-gate-title"
    >
      {/* Curtain split: two halves slide apart to reveal the site */}
      {opening ? (
        <>
          <div className="entry-gate__curtain-left entry-gate__curtain--open-left" />
          <div className="entry-gate__curtain-right entry-gate__curtain--open-right" />
        </>
      ) : null}

      {!opening ? (
        <div className="relative z-10 flex h-full max-h-dvh items-center justify-center overflow-hidden">
          <div className="entry-gate__panel w-full max-w-[420px] -translate-y-8 px-6 pb-10 pt-12 text-center text-[#ffffff] sm:-translate-y-10 sm:pb-12 sm:pt-14">
            {/* Decorative top line */}
            <span className="entry-gate__line mx-auto mb-8 block h-px w-12 bg-[#ffffff]/35" />

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND_LOGO_SRC}
              alt=""
              aria-hidden
              className="entry-gate__mark mx-auto h-auto w-[min(52vw,220px)]"
            />

            {visiblePhase === "welcome" ? (
              <>
                <h2
                  id="entry-gate-title"
                  className="entry-gate__welcome mt-8 text-[13px] font-bold tracking-[0.28em] text-[#ffffff] uppercase sm:text-[15px]"
                >
                  Welcome to {SITE.name}
                </h2>
                <p className="entry-gate__welcome mt-3 text-[10px] tracking-[0.22em] text-[#ffffff]/55 uppercase sm:text-[11px]">
                  Step in.
                </p>
                <span className="entry-gate__progress mx-auto mt-8 block h-[2px] w-16 overflow-hidden rounded-full bg-[#ffffff]/15">
                  <span className="entry-gate__progress-bar block h-full bg-[#ffffff]" />
                </span>
              </>
            ) : visiblePhase === "rejected" ? (
              <>
                <h2
                  id="entry-gate-title"
                  className="mt-8 text-[13px] font-bold text-[#ffffff] uppercase sm:text-[15px]"
                >
                  <span className="tracking-[0.28em]">{SITE.name}</span>
                  <span className="tracking-[0.12em] normal-case"> isn&apos;t for everyone.</span>
                </h2>
                <p className="mt-3 text-[10px] tracking-[0.18em] text-[#ffffff]/45 uppercase sm:text-[11px]">
                  This side is for those who move different.
                </p>
                <button
                  type="button"
                  onClick={reconsider}
                  className="entry-gate__btn-solid mx-auto mt-10 block w-full max-w-[220px]"
                >
                  THEN YOU&apos;RE ONE OF US.
                </button>
              </>
            ) : (
              <>
                <h2
                  id="entry-gate-title"
                  className="mt-8 text-[15px] font-bold tracking-[0.28em] text-[#ffffff] uppercase sm:text-[18px]"
                >
                  Are you really different?
                </h2>

                <div className="mx-auto mt-10 grid max-w-[280px] grid-cols-2 gap-4">
                  <button type="button" onClick={accept} className="entry-gate__btn-solid">
                    Yes
                  </button>
                  <button type="button" onClick={reject} className="entry-gate__btn-outline">
                    No
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>,
    document.body
  );
}
