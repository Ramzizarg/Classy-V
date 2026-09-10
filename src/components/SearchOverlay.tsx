"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CloseGlyph, SearchGlyph } from "@/components/SocialGlyphs";
import { formatPrice } from "@/lib/format";
import { effectivePrice, filterProducts } from "@/lib/products";
import type { Product } from "@/lib/types";

/** Full-screen illicitbloc-style search: bar on top, product grid below. */
export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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

        {!ready ? (
          <p className="search-overlay__empty">Loading…</p>
        ) : matches.length === 0 ? (
          <p className="search-overlay__empty">No products match</p>
        ) : (
          <div className="search-overlay__grid">
            {matches.map((product) => (
              <Link
                key={product.id}
                href={`/collection/${product.slug}`}
                onClick={onClose}
                className="search-overlay__card"
              >
                <span className="search-overlay__media">
                  <Image
                    src={product.images[0]}
                    alt={product.name}
                    fill
                    sizes="(min-width: 768px) 25vw, 50vw"
                    className="search-overlay__img"
                  />
                </span>
                <span className="search-overlay__title">{product.name}</span>
                <span className="search-overlay__price">{formatPrice(effectivePrice(product))}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
