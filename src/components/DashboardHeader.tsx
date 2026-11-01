"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Package,
  Home,
  Globe,
  LogOut,
  Ruler,
  Megaphone,
} from "lucide-react";
import { BRAND_LOGO_SRC } from "@/components/BrandMark";
import { DashboardOnlineVisitors } from "@/components/DashboardOnlineVisitors";
import { DashboardXDeliveryStatus } from "@/components/DashboardXDeliveryStatus";

type NavIcon = typeof LayoutDashboard;

type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  active: (pathname: string) => boolean;
};

const NAV_PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, active: (p) => p === "/dashboard" },
  { href: "/dashboard/analytiques", label: "Analytics", icon: BarChart3, active: (p) => p === "/dashboard/analytiques" },
  { href: "/dashboard/produits", label: "Products", icon: Package, active: (p) => p === "/dashboard/produits" },
  { href: "/dashboard/ads", label: "Ads", icon: Megaphone, active: (p) => p === "/dashboard/ads" },
];

const NAV_SECONDARY: NavItem[] = [
  { href: "/dashboard/home", label: "Home", icon: Home, active: (p) => p === "/dashboard/home" },
  { href: "/dashboard/tailles", label: "Sizes", icon: Ruler, active: (p) => p === "/dashboard/tailles" },
  { href: "/", label: "View site", icon: Globe, active: () => false },
];

const NAV_ALL = [...NAV_PRIMARY, ...NAV_SECONDARY];

export function DashboardHeader() {
  const pathname = usePathname();

  const linkClass = (active: boolean) =>
    `font-medium flex items-center gap-2 px-2.5 py-2 lg:px-3 rounded-lg transition-all duration-200 ${
      active ? "text-white bg-white/10" : "text-zinc-400 hover:text-white hover:bg-white/5"
    }`;

  const mobileIconClass = (active: boolean) =>
    `flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-lg px-0.5 py-1.5 transition ${
      active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
    }`;

  const renderLogo = (className: string) => (
    <Link href="/dashboard" className="block min-w-0 rounded">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BRAND_LOGO_SRC} alt="Classy V" className={className} />
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 bg-black text-white border-b border-white/10">
      {/* Mobile: logo + live status, then every page icon in the header */}
      <div className="md:hidden">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2">
          <div />
          <div className="flex justify-center">
            {renderLogo("h-9 w-auto max-w-[7rem] object-contain brightness-0 invert")}
          </div>
          <div className="flex min-w-0 items-center justify-end gap-1.5">
            <DashboardXDeliveryStatus compact />
            <DashboardOnlineVisitors compact />
          </div>
        </div>
        <nav
          aria-label="Back office"
          className="grid grid-cols-8 items-stretch gap-0.5 border-t border-white/10 px-1.5 py-1"
        >
          {NAV_ALL.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={item.active(pathname) ? "page" : undefined}
              className={mobileIconClass(item.active(pathname))}
            >
              <item.icon className="h-5 w-5 shrink-0" />
            </Link>
          ))}
          <form action="/api/admin/logout" method="post" className="min-w-0">
            <button type="submit" className={`${mobileIconClass(false)} w-full`} aria-label="Logout">
              <LogOut className="h-5 w-5 shrink-0" />
            </button>
          </form>
        </nav>
      </div>

      {/* Tablet / desktop: full nav around the mark */}
      <div className="hidden md:block">
        <div className="mx-auto flex max-w-6xl min-w-0 flex-col gap-2 px-4 py-3 lg:px-6 lg:py-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            <nav className="flex min-w-0 flex-wrap items-center justify-end gap-0.5 text-xs uppercase tracking-[0.12em]">
              {NAV_PRIMARY.map((item) => (
                <Link key={item.href} href={item.href} className={linkClass(item.active(pathname))}>
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              ))}
            </nav>
            <div className="flex justify-center px-1">
              {renderLogo("h-12 w-auto object-contain brightness-0 invert lg:h-16")}
            </div>
            <nav className="flex min-w-0 flex-wrap items-center justify-start gap-0.5 text-xs uppercase tracking-[0.12em]">
              {NAV_SECONDARY.map((item) => (
                <Link key={item.href} href={item.href} className={linkClass(item.active(pathname))}>
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden lg:inline">{item.label === "View site" ? "Site" : item.label}</span>
                </Link>
              ))}
              <form action="/api/admin/logout" method="post">
                <button type="submit" className={linkClass(false)} aria-label="Logout">
                  <LogOut className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden lg:inline">Logout</span>
                </button>
              </form>
            </nav>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DashboardXDeliveryStatus />
            <DashboardOnlineVisitors />
          </div>
        </div>
      </div>
    </header>
  );
}
