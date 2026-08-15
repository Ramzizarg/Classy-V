"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { ShippingPolicyModal } from "@/components/ShippingPolicyModal";
import { BagGlyph, InstagramGlyph, MenuGlyph, SearchGlyph } from "@/components/SocialGlyphs";
import { useStore } from "@/components/StoreProvider";
import { formatPrice } from "@/lib/format";
import { CATEGORIES, COLLECTIONS, effectivePrice, filterProducts } from "@/lib/products";
import { INFO_NAV, SITE } from "@/lib/site";
import type { Product } from "@/lib/types";

const SUGGESTION_LIMIT = 6;

/** Live catalog from Neon — fetched once when search opens. */
function SearchResults({ term, onPick }: { term: string; onPick: () => void }) {
  const [catalog, setCatalog] = useState<Product[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/catalog")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { products?: Product[] }) => {
        if (!cancelled) setCatalog(Array.isArray(data.products) ? data.products : []);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const matches = useMemo(() => filterProducts({ query: term, source: catalog }), [term, catalog]);
  const shown = matches.slice(0, SUGGESTION_LIMIT);

  if (shown.length === 0) {
    return <p className="ui-sm px-3 py-3 text-muted">No products match</p>;
  }

  return (
    <>
      {shown.map((product) => (
        <Link
          key={product.id}
          href={`/collection/${product.slug}`}
          onClick={onPick}
          className="flex items-center gap-3 border-b border-line px-3 py-2 hover:bg-surface"
        >
          <span className="block h-12 w-10 shrink-0 border border-line">
            <Image
              src={product.images[0]}
              alt=""
              aria-hidden
              width={80}
              height={100}
              className="h-full w-full object-contain p-0.5"
            />
          </span>
          <span className="ui min-w-0 flex-1">
            {product.name}
          </span>
          <span className="ui shrink-0 tabular-nums text-price">
            {formatPrice(effectivePrice(product))}
          </span>
        </Link>
      ))}

      {matches.length > shown.length ? (
        <Link
          href={`/collection?q=${encodeURIComponent(term)}`}
          onClick={onPick}
          className="ui-sm hover-underline block px-3 py-2 text-muted"
        >
          See all {matches.length} results
        </Link>
      ) : null}
    </>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { count, openCart, hydrated } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [lastPath, setLastPath] = useState(pathname);

  /** Navigating away closes the menu (state adjusted during render, not in an effect). */
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  /** Runs after the pop-up's own lock (it sits deeper in the tree), so it has the last word. */
  useEffect(() => {
    document.body.style.overflow = menuOpen || policyOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen, policyOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const term = query.trim();

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    router.push(term ? `/collection?q=${encodeURIComponent(term)}` : "/collection");
    setQuery("");
  };

  return (
    <>
      {/* Scrolls away on mobile; only the desktop bar sticks, since the rail pins beneath it. */}
      <header className="camo-surface z-[100] px-3 pt-3 pb-2 sm:px-5 lg:sticky lg:top-0 lg:pt-7 lg:pb-2">
        {/* Mobile bar: menu left, mark centred, bag right. Yields to the open menu panel. */}
        <div
          className={`shell-width items-center justify-between lg:hidden ${
            menuOpen ? "hidden" : "flex"
          }`}
        >
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="-m-1 p-1"
          >
            <MenuGlyph className="h-6 w-6" />
          </button>

          <BrandMark className="h-12 w-auto" />

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

        <div className="shell-width hidden items-center justify-end gap-5 sm:gap-7 lg:flex">
          <div className="relative">
            <form onSubmit={submitSearch} className="flex items-center gap-2">
              <SearchGlyph />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                aria-label="Search products"
                className="field field--line ui w-24 sm:w-40"
              />
            </form>

            {term ? (
              <div className="camo-surface absolute top-[calc(100%+8px)] right-0 z-20 w-80 border border-line">
                <SearchResults term={term} onPick={() => setQuery("")} />
              </div>
            ) : null}
          </div>

          <button type="button" onClick={openCart} className="flex items-center gap-2">
            <BagGlyph />
            <span className="ui hover-underline">Cart ({hydrated ? count : 0})</span>
          </button>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-[200] lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/80"
          />
          <nav className="camo-surface overlay-panel--left absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col overflow-y-auto border-r border-line">
            <div className="flex items-start justify-between px-4 py-3">
              <BrandMark className="h-14 w-auto" />
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

            <form onSubmit={submitSearch} className="flex items-center gap-2 px-4 pb-3">
              <SearchGlyph />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                aria-label="Search products"
                className="field field--line ui flex-1"
              />
            </form>

            {term ? (
              <div className="mx-4 mb-4 border border-line">
                <SearchResults term={term} onPick={() => setQuery("")} />
              </div>
            ) : null}

            <div className="mt-auto flex flex-col border-t border-line px-4 py-4">
              {INFO_NAV.map((item) =>
                /* The policy is a pop-up, so it closes the menu and opens over the page. */
                item.href === "/shipping-returns" ? (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setPolicyOpen(true);
                    }}
                    className="ui hover-underline py-1.5 text-left"
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link key={item.href} href={item.href} className="ui hover-underline py-1.5">
                    {item.label}
                  </Link>
                )
              )}
              <a
                href={SITE.instagram}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-foreground"
              >
                <InstagramGlyph className="h-4 w-4" />
                <span className="ui">Instagram</span>
              </a>
            </div>
          </nav>
        </div>
      ) : null}

      {/* Kept outside the menu panel so closing the menu does not tear the pop-up down. */}
      {policyOpen ? <ShippingPolicyModal onClose={() => setPolicyOpen(false)} /> : null}
    </>
  );
}
