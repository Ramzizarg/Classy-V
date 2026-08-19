"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { SITE } from "@/lib/site";

/** Matches `SiteLoadSplash` — the question waits until the logo animation clears. */
const SPLASH_MS = 1500;
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

function subscribeToEntryGate() {
  return () => {};
}

export function SiteEntryGate() {
  const pathname = usePathname();
  const exempt = isExemptPath(pathname);

  const mounted = useSyncExternalStore(subscribeToEntryGate, () => true, () => false);
  const storedChoice = useSyncExternalStore(subscribeToEntryGate, readChoice, () => null);
  const [phase, setPhase] = useState<GatePhase>("idle");

  useEffect(() => {
    if (exempt || !mounted || storedChoice) return;

    const timer = window.setTimeout(() => setPhase("question"), SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, [exempt, mounted, storedChoice]);

  useEffect(() => {
    if (phase !== "welcome") return;

    const timer = window.setTimeout(() => setPhase("opening"), WELCOME_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "opening") return;

    const timer = window.setTimeout(() => {
      writeChoice("yes");
      setPhase("idle");
    }, OPEN_MS);

    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (exempt || storedChoice === "yes") return;
    if (phase !== "question" && phase !== "welcome" && phase !== "opening" && storedChoice !== "no") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
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
      className={`fixed inset-0 z-[9990] ${opening ? "pointer-events-none" : ""}`}
      role="dialog"
      aria-modal
      aria-labelledby="entry-gate-title"
    >
      {/* Curtain split: two halves slide apart to reveal the site */}
      <div className={`entry-gate__curtain-left ${opening ? "entry-gate__curtain--open-left" : ""}`} />
      <div className={`entry-gate__curtain-right ${opening ? "entry-gate__curtain--open-right" : ""}`} />

      {!opening ? (
        <div className="relative z-10 flex h-full items-center justify-center">
          <div className="entry-gate__panel w-full max-w-[420px] px-6 pb-10 pt-12 text-center sm:pb-12 sm:pt-14">
            {/* Decorative top line */}
            <span className="entry-gate__line mx-auto mb-8 block h-px w-12 bg-white/20" />

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/classy-v-splash.png"
              alt=""
              aria-hidden
              className="entry-gate__mark mx-auto h-auto w-[min(48vw,180px)]"
            />

            {visiblePhase === "welcome" ? (
              <>
                <h2
                  id="entry-gate-title"
                  className="entry-gate__welcome mt-8 text-[13px] font-bold tracking-[0.28em] text-white uppercase sm:text-[15px]"
                >
                  Welcome to {SITE.name}
                </h2>
                <p className="entry-gate__welcome mt-3 text-[10px] tracking-[0.22em] text-white/50 uppercase sm:text-[11px]">
                  Step in.
                </p>
                <span className="entry-gate__progress mx-auto mt-8 block h-[2px] w-16 overflow-hidden rounded-full bg-white/10">
                  <span className="entry-gate__progress-bar block h-full bg-white/60" />
                </span>
              </>
            ) : visiblePhase === "rejected" ? (
              <>
                <h2
                  id="entry-gate-title"
                  className="mt-8 text-[13px] font-bold tracking-[0.28em] text-white uppercase sm:text-[15px]"
                >
                  {SITE.name} isn&apos;t for everyone.
                </h2>
                <p className="mt-3 text-[10px] tracking-[0.18em] text-white/40 uppercase sm:text-[11px]">
                  This side is for those who move different.
                </p>
                <button
                  type="button"
                  onClick={reconsider}
                  className="entry-gate__btn-solid mx-auto mt-10 block w-full max-w-[220px]"
                >
                  Actually, I do
                </button>
              </>
            ) : (
              <>
                <h2
                  id="entry-gate-title"
                  className="mt-8 text-[15px] font-bold tracking-[0.28em] text-white uppercase sm:text-[18px]"
                >
                  Do you move different?
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
