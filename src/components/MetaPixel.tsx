"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { isMetaPixelSkipped, trackMeta } from "@/lib/metaPixel";

function MetaPixelTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const skip = isMetaPixelSkipped(pathname);
  const firstView = useRef(true);

  useEffect(() => {
    if (skip) return;
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    trackMeta("PageView");
  }, [pathname, searchParams, skip]);

  return null;
}

/** Meta Pixel 2161579940909722 — storefront only, including client-side navigations. */
export function MetaPixel() {
  return (
    <Suspense fallback={null}>
      <MetaPixelTracker />
    </Suspense>
  );
}
