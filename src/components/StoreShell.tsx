"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { CartDrawer } from "@/components/CartDrawer";
import { ShopRail } from "@/components/ShopRail";
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

  if (matchesPath(pathname, CHROMELESS_PATHS) || CHROMELESS_EXACT.includes(pathname)) {
    return <>{children}</>;
  }

  if (matchesPath(pathname, HEADER_ONLY_PATHS)) {
    return (
      <>
        <SiteHeader />
        <main className="flex min-h-[calc(100%-var(--header-height))] flex-1 flex-col">
          {children}
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <div className="site-shell shell-width flex-1">
        <Suspense fallback={<div className="hidden lg:block" />}>
          <ShopRail />
        </Suspense>
        <div className="flex min-h-full min-w-0 flex-1 flex-col">
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </div>
      <CartDrawer />
    </>
  );
}
