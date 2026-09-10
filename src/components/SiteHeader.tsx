"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const { count, openCart, hydrated } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  /** Navigating away closes overlays (state adjusted during render, not in an effect). */
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
  }

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

  return (
    <>
      {/*
        Home: fixed over the hero so it stays with you while scrolling.
        Elsewhere: sticky bar.
      */}
      <header
        className={`z-[100] bg-transparent px-3 pt-3 pb-2 text-black sm:px-5 lg:pt-7 lg:pb-2 ${
          pathname === "/" ? "site-header--home" : "sticky top-0"
        }`}
      >
        {/* Mobile: menu + search left, mark centre, bag right. */}
        <div
          className={`shell-width grid grid-cols-3 items-center lg:hidden ${
            menuOpen || searchOpen ? "hidden" : ""
          }`}
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
            <BrandMark className="h-12 w-auto" onClick={() => replaySplash()} />
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

        <div
          className={`shell-width hidden items-center justify-end gap-5 sm:gap-7 lg:flex ${
            searchOpen ? "!hidden" : ""
          }`}
        >
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
      </header>

      {searchOpen ? <SearchOverlay onClose={() => setSearchOpen(false)} /> : null}

      {menuOpen ? (
        <div className="fixed inset-0 z-[200] lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/80"
          />
          <nav className="camo-surface drawer-panel overlay-panel--left absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col overflow-y-auto border-r border-line">
            <div className="flex items-start justify-between px-4 py-3">
              <BrandMark className="h-14 w-auto" onClick={() => replaySplash()} />
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
                  className="ui hover-underline py-1.5"
                >
                  {entry.label}
                </Link>
              ))}
              {CATEGORIES.map((category) => (
                <Link
                  key={category.slug}
                  href={`/collection?category=${category.slug}`}
                  className="ui hover-underline py-1.5"
                >
                  {category.name}
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
