"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LookbookCard } from "@/components/LookbookCard";
import { CloseGlyph, SearchGlyph } from "@/components/SocialGlyphs";
import { useStore } from "@/components/StoreProvider";
import { filterProducts } from "@/lib/products";
import type { Product } from "@/lib/types";

/** Full-screen illicitbloc-style search: bar on top, product grid below. */
export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [ready, setReady] = useState(false);
  const { cartOpen } = useStore();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* Quick-add from a tile opens the cart, which sits under this overlay. */
  useEffect(() => {
    if (cartOpen) onClose();
  }, [cartOpen, onClose]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/catalog")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { products?: Product[] }) => {
        if (!cancelled) {
          setCatalog(Array.isArray(data.products) ? data.products : []);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog([]);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const term = query.trim();
  const matches = useMemo(
    () => (term ? filterProducts({ query: term, source: catalog }) : catalog),
    [term, catalog]
  );

  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Search">
      <form
        className="search-overlay__bar"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <SearchGlyph className="h-5 w-5 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          aria-label="Search products"
          className="search-overlay__input"
        />
        <button type="button" onClick={onClose} aria-label="Close search" className="search-overlay__close">
          <CloseGlyph className="h-5 w-5" />
        </button>
      </form>

      <div className="search-overlay__body">
        <h2 className="search-overlay__heading">Products</h2>

        <div className="search-overlay__scroll">
          {!ready ? (
            <p className="search-overlay__empty">Loading…</p>
          ) : matches.length === 0 ? (
            <p className="search-overlay__empty">No products match</p>
          ) : (
            <div className="lookbook-hero search-overlay__results">
              <div className="lookbook__grid">
                {matches.map((product, index) => (
                  <LookbookCard key={product.id} product={product} priority={index < 4} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
