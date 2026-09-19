"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { replaySplash } from "@/components/SiteLoadSplash";
import { SearchOverlay } from "@/components/SearchOverlay";
import { BagGlyph, MenuGlyph, SearchGlyph } from "@/components/SocialGlyphs";
import { SocialLinks } from "@/components/SocialLinks";
import { useStore } from "@/components/StoreProvider";
import { CATEGORIES, COLLECTIONS } from "@/lib/products";

export function SiteHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { count, openCart, hydrated } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [lastLocation, setLastLocation] = useState(`${pathname}?${searchParams.toString()}`);

  const locationKey = `${pathname}?${searchParams.toString()}`;

  /** Any route or filter change closes overlays (including same-page category clicks). */
  if (lastLocation !== locationKey) {
    setLastLocation(locationKey);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen || searchOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen, searchOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isLookbookShop = pathname === "/" || pathname === "/collection";
  const isHome = pathname === "/";
  const isProductPage = /^\/collection\/[^/]+/.test(pathname);
  const category = searchParams.get("category");
  const collection = searchParams.get("collection");
  const onShop = pathname === "/" || pathname.startsWith("/collection");

  return (
    <>
      {/*
        Lookbook shop (home + collection): fixed over the hero.
        Elsewhere: fixed store bar.
        Desktop: shop links live in the header (no left rail).
      */}
      <header
        className={`site-header z-[100] px-3 pt-3 pb-2 sm:px-5 lg:pt-7 lg:pb-2 ${
          isLookbookShop
            ? "site-header--home"
            : isProductPage
              ? "site-header--store site-header--product"
              : "site-header--store text-[var(--foreground)]"
        }`}
      >
        <div className="site-top-line" aria-hidden="true" />
        {/*
          Mobile everywhere + home desktop: hamburger left, mark centre, bag right.
          Other desktop pages keep the inline shop nav below.
        */}
        <div
          className={`shell-width grid grid-cols-3 items-center ${
            isHome ? "" : "lg:hidden"
          } ${menuOpen || searchOpen ? "hidden" : ""}`}
        >
          <div className="flex items-center justify-start gap-0.5">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="-m-1 p-1"
            >
              <MenuGlyph className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="-m-1 p-1"
            >
              <SearchGlyph className="h-6 w-6" />
            </button>
          </div>

          <div className="flex justify-center">
            <BrandMark
              className={`w-auto ${isHome ? "h-14 xl:h-16" : "h-14"}`}
              onClick={() => {
                if (isHome) replaySplash();
              }}
            />
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={openCart}
              aria-label={`Cart (${hydrated ? count : 0})`}
              className="-m-1 flex items-center gap-1 p-1"
            >
              <BagGlyph className="h-6 w-6" />
              {hydrated && count > 0 ? <span className="ui-sm">{count}</span> : null}
            </button>
          </div>
        </div>

        {/* Desktop (non-home): logo + shop links + cart. */}
        <div
          className={`shell-width hidden items-center gap-5 xl:gap-7 ${
            isHome ? "" : "lg:flex"
          } ${searchOpen ? "!hidden" : ""}`}
        >
          <BrandMark
            className="h-11 w-auto shrink-0"
            onClick={() => {
              if (isHome) replaySplash();
            }}
          />
          <nav
            aria-label="Shop"
            className="header-shop-nav no-scrollbar flex min-w-0 flex-1 items-center gap-x-4 overflow-x-auto overflow-y-hidden xl:gap-x-5"
          >
            {COLLECTIONS.map((entry) => {
              const active =
                onShop &&
                !category &&
                (entry.key === "new" ? !collection : collection === entry.key);
              return (
                <Link
                  key={entry.key}
                  href={entry.key === "new" ? "/collection" : `/collection?collection=${entry.key}`}
                  data-active={active ? "true" : undefined}
                  className="header-shop-nav__link hover-underline shrink-0"
                >
                  {entry.label}
                </Link>
              );
            })}
            {CATEGORIES.map((item) => (
              <Link
                key={item.slug}
                href={`/collection?category=${item.slug}`}
                data-active={category === item.slug ? "true" : undefined}
                className="header-shop-nav__link hover-underline shrink-0"
              >
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center justify-end gap-5 sm:gap-7">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="-m-1 p-1"
            >
              <SearchGlyph className="h-5 w-5" />
            </button>
            <button type="button" onClick={openCart} className="flex items-center gap-2">
              <BagGlyph />
              <span className="ui hover-underline">Cart ({hydrated ? count : 0})</span>
            </button>
          </div>
        </div>
      </header>

      {searchOpen ? <SearchOverlay onClose={() => setSearchOpen(false)} /> : null}

      {menuOpen ? (
        <div className={`fixed inset-0 z-[200] ${isHome ? "" : "lg:hidden"}`}>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/80"
          />
          <nav className="camo-surface drawer-panel overlay-panel--left absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col overflow-y-auto border-r border-line">
            <div className="flex items-start justify-between px-4 py-3">
              <BrandMark
                className="h-14 w-auto"
                onClick={() => {
                  setMenuOpen(false);
                  if (isHome) replaySplash();
                }}
              />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="ui hover-underline"
              >
                Close
              </button>
            </div>

            <div className="flex flex-col px-4 pb-4">
              {COLLECTIONS.map((entry) => (
                <Link
                  key={entry.key}
                  href={entry.key === "new" ? "/collection" : `/collection?collection=${entry.key}`}
                  onClick={closeMenu}
                  className="rail-link hover-underline"
                >
                  {entry.label}
                </Link>
              ))}
              {CATEGORIES.map((entry) => (
                <Link
                  key={entry.slug}
                  href={`/collection?category=${entry.slug}`}
                  onClick={closeMenu}
                  className="rail-link hover-underline"
                >
                  {entry.name}
                </Link>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setSearchOpen(true);
              }}
              className="mx-4 mb-8 flex items-center gap-2"
            >
              <SearchGlyph />
              <span className="ui hover-underline">Search</span>
            </button>

            <div className="mx-4 border-t border-line" aria-hidden="true" />

            <div className="px-4 pt-6 pb-6">
              <SocialLinks />
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
