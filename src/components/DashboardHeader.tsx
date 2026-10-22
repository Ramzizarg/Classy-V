"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard,
  BarChart3,
  Package,
  Home,
  Globe,
  LogOut,
  Ruler,
  Megaphone,
  Menu,
  X,
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

export function DashboardHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const linkClass = (active: boolean) =>
    `font-medium flex items-center gap-2 px-2.5 py-2 lg:px-3 rounded-lg transition-all duration-200 ${
      active ? "text-white bg-white/10" : "text-zinc-400 hover:text-white hover:bg-white/5"
    }`;

  const drawerLinkClass = (active: boolean) =>
    `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium tracking-wide transition ${
      active ? "bg-white/10 text-white" : "text-zinc-300 hover:bg-white/5 hover:text-white"
    }`;

  const renderLogo = (className: string) => (
    <Link href="/dashboard" className="block min-w-0 rounded" onClick={() => setMenuOpen(false)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BRAND_LOGO_SRC} alt="Classy V" className={className} />
    </Link>
  );

  const drawer =
    mounted && menuOpen
      ? createPortal(
          <div className="fixed inset-0 z-[120] md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/55"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />
            <nav
              aria-label="Back office"
              className="relative flex h-full w-[min(19rem,86vw)] flex-col bg-black text-white shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                {renderLogo("h-10 w-auto max-w-[7.5rem] object-contain brightness-0 invert")}
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Manage
                </p>
                {NAV_PRIMARY.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={drawerLinkClass(item.active(pathname))}
                    onClick={() => setMenuOpen(false)}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                ))}
                <p className="px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Site
                </p>
                {NAV_SECONDARY.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={drawerLinkClass(item.active(pathname))}
                    onClick={() => setMenuOpen(false)}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="border-t border-white/10 p-3">
                <form action="/api/admin/logout" method="post">
                  <button type="submit" className={`${drawerLinkClass(false)} w-full`}>
                    <LogOut className="h-4 w-4 shrink-0" />
                    Logout
                  </button>
                </form>
              </div>
            </nav>
          </div>,
          document.body
        )
      : null;

  return (
    <header className="sticky top-0 z-50 bg-black text-white border-b border-white/10">
      {/* Mobile: hamburger · logo · live visitors */}
      <div className="md:hidden">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2">
          <div className="flex min-w-0 items-center justify-start">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-white/10"
              aria-label="Open menu"
              aria-expanded={menuOpen}
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
          <div className="flex justify-center">
            {renderLogo("h-10 w-auto max-w-[7.5rem] object-contain brightness-0 invert")}
          </div>
          <div className="flex min-w-0 items-center justify-end gap-1.5">
            <DashboardXDeliveryStatus compact />
            <DashboardOnlineVisitors compact />
          </div>
        </div>
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
      {drawer}
    </header>
  );
}
