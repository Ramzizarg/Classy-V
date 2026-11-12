"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { QuickAddDrawer } from "@/components/QuickAddDrawer";
import { useStore } from "@/components/StoreProvider";
import { formatPrice } from "@/lib/format";
import { effectivePrice, isComingSoon, isSoldOut } from "@/lib/products";
import type { Product } from "@/lib/types";

const MAX_CARDS = 16;

type Card = { lead: Product; colours: Product[] };

/** The catalog has no colour column, so the swatch reads the colour word in the product name. */
const NAMED_COLOURS: [RegExp, string][] = [
  [/\b(white|blanc|cream|ecru)\b/i, "#f4f2ee"],
  [/\b(grey|gray|gris|ash)\b/i, "#9a9a9a"],
  [/\b(purple|violet|plum)\b/i, "#8e3a74"],
  [/\b(navy)\b/i, "#1f2a5a"],
  [/\b(blue|bleu)\b/i, "#2f5fb3"],
  [/\b(green|vert|olive|khaki)\b/i, "#55613a"],
  [/\b(red|rouge)\b/i, "#b3201c"],
  [/\b(brown|marron|chocolate)\b/i, "#5b3a29"],
  [/\b(beige|sand|taupe)\b/i, "#c9b79c"],
  [/\b(pink|rose)\b/i, "#e3a1b4"],
  [/\b(black|noir)\b/i, "#111111"],
];

/** Last colour word wins, so "Violet Tee - Black" reads as black, not purple. */
function swatchColour(product: Product): string {
  const label = `${product.name} ${product.colorway}`;
  let best: { at: number; hex: string } | null = null;
  for (const [pattern, hex] of NAMED_COLOURS) {
    const at = label.search(pattern);
    if (at >= 0 && (!best || at > best.at)) best = { at, hex };
  }
  return best?.hex ?? product.colorHex ?? "#111111";
}

/** One card per colourway; swatches list every colour of the same variant group. */
function buildCards(products: Product[]): Card[] {
  const byGroup = new Map<string, Product[]>();
  for (const product of products) {
    const group = product.variantGroup?.trim();
    if (!group) continue;
    const list = byGroup.get(group);
    if (list) list.push(product);
    else byGroup.set(group, [product]);
  }
  return products.slice(0, MAX_CARDS).map((product) => {
    const group = product.variantGroup?.trim();
    return { lead: product, colours: (group && byGroup.get(group)) || [product] };
  });
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        d="M6.5 3.5h11v17l-5.5-4-5.5 4z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HomeShopRow({ products }: { products: Product[] }) {
  const { toggleWishlist, wishlist, hydrated } = useStore();
  const cards = useMemo(() => buildCards(products), [products]);
  const [quick, setQuick] = useState<Product | null>(null);
  const closeQuick = useCallback(() => setQuick(null), []);
  if (cards.length === 0) return null;

  return (
    <section className="cv-shop" aria-label="Shop the drop">
      <header className="cv-shop__head">
        <h2 className="cv-shop__title">Shop the drop.</h2>
        <Link href="/collection" className="cv-shop__all hover-underline">
          View all
        </Link>
      </header>

      <ul className="cv-shop__track">
        {cards.map(({ lead, colours }) => {
          const comingSoon = isComingSoon(lead);
          const soldOut = !comingSoon && isSoldOut(lead);
          const saved = hydrated && wishlist.includes(lead.id);
          const href = `/collection/${lead.slug}`;
          return (
            <li key={lead.id} className="cv-shop__card">
              <div className="cv-shop__frame">
                <Link href={href} className="cv-shop__media" aria-label={lead.name}>
                  <Image
                    src={lead.images[0]}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 19vw, (min-width: 768px) 28vw, 46vw"
                    className={`cv-shop__img${lead.images[1] ? " cv-shop__img--main" : ""}`}
                  />
                  {lead.images[1] ? (
                    <Image
                      src={lead.images[1]}
                      alt=""
                      aria-hidden
                      fill
                      sizes="(min-width: 1280px) 19vw, (min-width: 768px) 28vw, 46vw"
                      className="cv-shop__img cv-shop__img--hover"
                    />
                  ) : null}
                  {comingSoon ? (
                    <span className="cv-shop__badge">Coming soon</span>
                  ) : soldOut ? (
                    <span className="cv-shop__badge">Sold out</span>
                  ) : null}
                </Link>

                <button
                  type="button"
                  className="cv-shop__plus"
                  aria-label={`Quick add ${lead.name}`}
                  onClick={() => setQuick(lead)}
                >
                  +
                </button>

                <button
                  type="button"
                  className={`cv-shop__save${saved ? " is-on" : ""}`}
                  aria-pressed={saved}
                  aria-label={saved ? `Remove ${lead.name} from wishlist` : `Save ${lead.name} to wishlist`}
                  onClick={() => toggleWishlist(lead.id)}
                >
                  <BookmarkIcon filled={saved} />
                </button>
              </div>

              <Link href={href} className="cv-shop__copy">
                <span className="cv-shop__row">
                  <span className="cv-shop__name">{lead.name}</span>
                  <span className="cv-shop__price tabular-nums">
                    {comingSoon ? "Soon" : formatPrice(effectivePrice(lead))}
                  </span>
                </span>
                <span className="cv-shop__colours">
                  {colours.slice(0, 5).map((c) => (
                    <span
                      key={c.id}
                      className="cv-shop__swatch"
                      style={{ background: swatchColour(c) }}
                      title={c.colorway || c.name}
                    />
                  ))}
                  <span className="cv-shop__count">
                    {colours.length} {colours.length === 1 ? "Colour" : "Colours"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <QuickAddDrawer key={quick?.id ?? "closed"} product={quick} onClose={closeQuick} />
    </section>
  );
}
