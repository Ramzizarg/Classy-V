"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { applySiteTheme, readSiteTheme } from "@/lib/siteTheme";

/** Re-applies the saved mode on every route, so the back office never inherits day mode. */
export function SiteThemeSync() {
  const pathname = usePathname();

  useEffect(() => {
    applySiteTheme(readSiteTheme(), pathname);
  }, [pathname]);

  return null;
}
