"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { META_PIXEL_ID, isMetaPixelSkipped, trackMeta } from "@/lib/metaPixel";

function MetaPixelTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const skip = isMetaPixelSkipped(pathname);

  useEffect(() => {
    if (skip) return;
    trackMeta("PageView");
  }, [pathname, searchParams, skip]);

  if (skip) return null;

  return (
    <noscript>
      <img
        height={1}
        width={1}
        style={{ display: "none" }}
        src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        alt=""
      />
    </noscript>
  );
}

/** Meta Pixel 2161579940909722 — storefront only, including client-side navigations. */
export function MetaPixel() {
  return (
    <Suspense fallback={null}>
      <MetaPixelTracker />
    </Suspense>
  );
}
