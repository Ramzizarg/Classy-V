"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { CartDrawer } from "@/components/CartDrawer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

/** Back office pages render their own dashboard chrome — no storefront header, rail, or footer. */
const CHROMELESS_PATHS = ["/admin", "/dashboard"];
/** Checkout runs a distraction-free flow with its own logo and step nav. */
const CHROMELESS_EXACT = ["/checkout"];
/** Auth pages keep the storefront header but drop the rail, footer and cart. */
const HEADER_ONLY_PATHS = ["/login"];

function matchesPath(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function StoreShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  /** Home is a full-bleed hero; collection keeps the lookbook chrome (no header spacer). */
  const isHome = pathname === "/";
  const isLookbookShop = isHome || pathname === "/collection";
  const isProductPage = /^\/collection\/[^/]+/.test(pathname);

  if (matchesPath(pathname, CHROMELESS_PATHS) || CHROMELESS_EXACT.includes(pathname)) {
    return <>{children}</>;
  }

  if (matchesPath(pathname, HEADER_ONLY_PATHS)) {
    return (
      <>
        <Suspense fallback={null}>
          <SiteHeader />
        </Suspense>
        <div className="site-header-spacer" aria-hidden="true" />
        <main className="flex min-h-[calc(100%-var(--header-height))] flex-1 flex-col">
          {children}
        </main>
      </>
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        <SiteHeader />
      </Suspense>
      {!isLookbookShop ? (
        <div
          className={`site-header-spacer${isProductPage ? " site-header-spacer--product" : ""}`}
          aria-hidden="true"
        />
      ) : null}
      {/* Desktop shop links live in the header — shell is always a single column. */}
      <div
        className={`site-shell shell-width flex-1 site-shell--no-rail${isHome ? " site-shell--home" : ""}`}
      >
        <div
          className={`site-shell__main flex min-w-0 flex-1 flex-col lg:min-h-0 ${
            isLookbookShop ? "min-h-dvh" : "min-h-[calc(100dvh-var(--header-height))]"
          }`}
        >
          <main className="flex-1">{children}</main>
        </div>
        <SiteFooter />
      </div>
      <CartDrawer />
    </>
  );
}
