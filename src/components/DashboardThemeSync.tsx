"use client";

import { useEffect } from "react";

/**
 * Storefront root uses a black body + dark color-scheme. While the dashboard
 * is mounted, force a white page canvas so nothing bleeds through behind the
 * black header.
 */
export function DashboardThemeSync() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("dashboard-light");
    body.classList.add("dashboard-light");
    return () => {
      html.classList.remove("dashboard-light");
      body.classList.remove("dashboard-light");
    };
  }, []);

  return null;
}
