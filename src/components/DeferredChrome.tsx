"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const PullToRefresh = dynamic(
  () => import("@/components/PullToRefresh").then((m) => m.PullToRefresh),
  { ssr: false }
);
const BackToTop = dynamic(
  () => import("@/components/BackToTop").then((m) => m.BackToTop),
  { ssr: false }
);
const PresenceBeacon = dynamic(
  () => import("@/components/PresenceBeacon").then((m) => m.PresenceBeacon),
  { ssr: false }
);
const Toaster = dynamic(
  () => import("@/components/Toaster").then((m) => m.Toaster),
  { ssr: false }
);
const ComingSoonGate = dynamic(
  () => import("@/components/ComingSoonGate").then((m) => m.ComingSoonGate),
  { ssr: false }
);

/**
 * Mounts non-critical chrome after first paint / idle so TBT and unused JS drop
 * without changing how the storefront works once loaded.
 */
export function DeferredChrome() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const enable = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(enable, { timeout: 2200 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const t = window.setTimeout(enable, 1);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  if (!ready) return null;

  return (
    <>
      <PullToRefresh />
      <BackToTop />
      <PresenceBeacon />
      <Toaster />
      <ComingSoonGate />
    </>
  );
}
