"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

/** Category index + product PDP share the white canvas. Home stays black. */
function isLightShopPath(pathname: string) {
  return pathname === "/collection" || /^\/collection\/[^/]+/.test(pathname);
}

/**
 * Shop / category / product pages: white canvas + dark ink, restored on leave.
 */
export function ProductPageThemeSync() {
  const pathname = usePathname();
  const active = isLightShopPath(pathname);

  useLayoutEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("product-light");
    body.classList.add("product-light");
    return () => {
      html.classList.remove("product-light");
      body.classList.remove("product-light");
    };
  }, [active]);

  return null;
}
