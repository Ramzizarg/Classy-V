"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandMark, BRAND_MARK_FOOTER_SRC } from "@/components/BrandMark";
import { effectivePrice, isComingSoon, isSoldOut } from "@/lib/products";
import type { Product } from "@/lib/types";

type RailItem = {
  id: number;
  slug: string;
  name: string;
  image: string;
  price: number;
  salePrice: number | null;
  comingSoon: boolean;
  soldOut: boolean;
};

const COPIES = 3;

/** Used when the local catalog is empty so the rail still previews. */
const FALLBACK_ITEMS: RailItem[] = [
  {
    id: 7,
    slug: "baggy-jogger-black",
    name: "Baggy Jogger Black",
    image: "https://8pz9hlket4r72cs1.public.blob.vercel-storage.com/uploads/products/1792281245989-9xvdj3.webp",
    price: 85,
    salePrice: 65,
    comingSoon: false,
    soldOut: false,
  },
  {
    id: 8,
    slug: "baggy-jogger-grey",
    name: "Baggy Jogger Grey",
    image: "https://8pz9hlket4r72cs1.public.blob.vercel-storage.com/uploads/products/1792283525958-sttzrc.webp",
    price: 85,
    salePrice: 65,
    comingSoon: false,
    soldOut: false,
  },
  {
    id: 9,
    slug: "hoodie-cropped-black",
    name: "Hoodie Cropped Black",
    image: "https://8pz9hlket4r72cs1.public.blob.vercel-storage.com/uploads/products/1792418556469-7ho3y9.webp",
    price: 99,
    salePrice: 75,
    comingSoon: true,
    soldOut: false,
  },
  {
    id: 10,
    slug: "hoodie-cropped-white",
    name: "Hoodie Cropped White",
    image: "https://8pz9hlket4r72cs1.public.blob.vercel-storage.com/uploads/products/1792421835881-jfg5sb.webp",
    price: 99,
    salePrice: 75,
    comingSoon: true,
    soldOut: false,
  },
  {
    id: 4,
    slug: "vandal-tee-black",
    name: "VANDAL TEE - Black",
    image: "/uploads/products/1786816146722-1zxvsz.webp",
    price: 89.99,
    salePrice: 75,
    comingSoon: false,
    soldOut: true,
  },
  {
    id: 5,
    slug: "violet-tee-purple",
    name: "VIOLET TEE - Purple",
    image: "/uploads/products/1786817522827-yzije4.webp",
    price: 89.99,
    salePrice: 75,
    comingSoon: false,
    soldOut: true,
  },
];

function toRailItem(product: Product): RailItem | null {
  const image = product.images.find((src) => src && !src.startsWith("/media/"));
  if (!image) return null;
  const sale = effectivePrice(product);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name.replace(/\bNoir\b/gi, "Black"),
    image,
    price: product.price,
    salePrice: sale < product.price ? sale : null,
    comingSoon: isComingSoon(product),
    soldOut: !isComingSoon(product) && isSoldOut(product),
  };
}

function tagPrice(value: number): string {
  return `${Number.isInteger(value) ? String(value) : value.toFixed(0)} DT`;
}

function tagLabel(item: RailItem, amount: number): string {
  if (item.comingSoon) return "COMING SOON";
  if (item.soldOut) return "SOLD OUT";
  return tagPrice(amount);
}

function uniqueBySlug(items: RailItem[]): RailItem[] {
  const seen = new Set<string>();
  const out: RailItem[] = [];
  for (const item of items) {
    if (seen.has(item.slug)) continue;
    seen.add(item.slug);
    out.push(item);
  }
  return out;
}

export function HomeClothesline({ products }: { products: Product[] }) {
  const rackRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progRef = useRef<HTMLElement>(null);
  const offset = useRef(0);
  const setWidth = useRef(0);
  const speed = useRef(0);
  const velocity = useRef(0);
  const paused = useRef(false);
  const reduceMotion = useRef(false);
  const skipClick = useRef(false);
  const lastTs = useRef(0);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    axis: "none" | "x" | "y";
    moved: boolean;
    t: number;
  } | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const ready = useRef(new Set<number>());
  const [, setReadyTick] = useState(0);

  const markReady = useCallback((index: number) => {
    if (ready.current.has(index)) return;
    ready.current.add(index);
    setReadyTick((tick) => tick + 1);
  }, []);

  const revealImg = useCallback(
    (index: number, node: HTMLImageElement | null) => {
      if (!node || ready.current.has(index)) return;
      const show = () => markReady(index);
      if (typeof node.decode === "function") {
        node.decode().then(show).catch(show);
      } else {
        show();
      }
    },
    [markReady],
  );

  const baseItems = useMemo(() => {
    const fromCatalog = products.map(toRailItem).filter((row): row is RailItem => row != null);
    return uniqueBySlug([...fromCatalog, ...FALLBACK_ITEMS]);
  }, [products]);

  const items = useMemo(
    () => Array.from({ length: COPIES }, () => baseItems).flat(),
    [baseItems],
  );

  const hovered = live != null ? items[live] : null;

  const wrapOffset = useCallback(() => {
    const width = setWidth.current;
    if (width <= 0) return;
    while (offset.current > 0) offset.current -= width;
    while (offset.current < -width * 2) offset.current += width;
  }, []);

  const paint = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    wrapOffset();
    track.style.transform = `translate3d(${offset.current}px, 0, 0)`;
    const width = setWidth.current;
    if (progRef.current && width > 0) {
      const p = ((-offset.current % width) + width) % width / width;
      progRef.current.style.transform = `scaleX(${Math.max(0.08, p)})`;
    }
  }, [wrapOffset]);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track || baseItems.length === 0) return;
    setWidth.current = track.scrollWidth / COPIES;
    if (offset.current === 0) offset.current = -setWidth.current;
    paint();
  }, [baseItems.length, paint]);

  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    measure();
    const frame = requestAnimationFrame(measure);
    const track = trackRef.current;
    if (!track) return () => cancelAnimationFrame(frame);
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [measure, items.length]);

  useEffect(() => {
    if (baseItems.length === 0) return;
    let frame = 0;
    const CRUISE = 34;
    const tick = (ts: number) => {
      const dt = lastTs.current ? Math.min(0.048, (ts - lastTs.current) / 1000) : 0.016;
      lastTs.current = ts;
      const draggingNow = Boolean(drag.current && drag.current.axis === "x");
      if (!draggingNow) {
        const target = paused.current || reduceMotion.current ? 0 : CRUISE;
        speed.current += (target - speed.current) * (1 - Math.exp(-dt * 7));
        if (Math.abs(velocity.current) > 0.4) {
          offset.current += velocity.current;
          velocity.current *= Math.exp(-dt * 4.2);
          if (Math.abs(velocity.current) < 0.4) velocity.current = 0;
        } else {
          offset.current -= speed.current * dt;
        }
        paint();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [baseItems.length, paint]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    skipClick.current = false;
    paused.current = true;
    velocity.current = 0;
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      axis: "none",
      moved: false,
      t: event.timeStamp,
    };
    setDragging(false);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (state.axis === "none") {
      if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
      state.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (state.axis === "y") {
        drag.current = null;
        setDragging(false);
        if (live == null) paused.current = false;
        return;
      }
    }
    if (state.axis !== "x") return;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const dt = Math.max(8, event.timeStamp - state.t);
    velocity.current = (dx / dt) * 16.6;
    offset.current += dx;
    state.x = event.clientX;
    state.y = event.clientY;
    state.t = event.timeStamp;
    state.moved = true;
    skipClick.current = true;
    if (!dragging) setDragging(true);
    paint();
    event.preventDefault();
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (live == null) paused.current = false;
  };

  const onItemClick = (event: React.MouseEvent) => {
    if (skipClick.current) {
      event.preventDefault();
      event.stopPropagation();
      skipClick.current = false;
    }
  };

  if (items.length === 0) return null;

  return (
    <section className="cv-rail" aria-label="New collection">
      <div className="cv-rail__intro">
        <BrandMark
          width={120}
          className="cv-rail__logo h-9 w-auto sm:h-10 lg:h-11"
          src={BRAND_MARK_FOOTER_SRC}
        />
        <p className="cv-rail__cap">
          <span>New collection</span>
          <i className="cv-rail__cap-sep" aria-hidden />
          <span className="cv-rail__cap-dim">Streetwear</span>
        </p>
      </div>

      <div className="cv-rail__stage">
        <div className="cv-rail__rod" aria-hidden>
          <svg viewBox="0 0 1000 28" preserveAspectRatio="none">
            <path d="M0 10 Q 500 26 1000 10" fill="none" stroke="#d7d0c6" strokeWidth="7" />
            <path d="M0 8 Q 500 24 1000 8" fill="none" stroke="#f7f3ec" strokeWidth="2.2" />
            <path d="M0 13 Q 500 28 1000 13" fill="none" stroke="rgba(80,70,58,0.18)" strokeWidth="1.4" />
          </svg>
        </div>

        <div
          ref={rackRef}
          className={`cv-rail__rack${dragging ? " is-dragging" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onMouseEnter={() => {
            paused.current = true;
          }}
          onMouseLeave={() => {
            if (!drag.current) paused.current = false;
            setLive(null);
          }}
        >
          <div ref={trackRef} className="cv-rail__track">
          {items.map((item, index) => {
            const amount = item.salePrice ?? item.price;
            const sway = ((index % 7) - 3) * 0.7;
            return (
              <Link
                key={`${item.id}-${index}`}
                href={`/collection/${item.slug}`}
                className={`cv-rail__item${live === index ? " is-live" : ""}${
                  item.comingSoon ? " is-soon" : item.soldOut ? " is-sold" : ""
                }`}
                style={{ ["--cv-sway" as string]: `${sway}deg` }}
                onMouseEnter={() => {
                  paused.current = true;
                  setLive(index);
                }}
                onFocus={() => setLive(index)}
                onBlur={() => setLive((current) => (current === index ? null : current))}
                onClick={onItemClick}
              >
                <span className="cv-rail__hook" aria-hidden>
                  <svg viewBox="0 0 36 30" fill="none">
                    <path d="M18 2.5c0 3.2-2.2 5.2-4.4 5.2" stroke="#8a8378" strokeWidth="1.4" strokeLinecap="round" />
                    <circle cx="18" cy="2.6" r="1.5" fill="#b9b2a6" />
                    <path d="M4 20.5 L18 9.5 L32 20.5" stroke="#9a9388" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6.2 20.2 L18 11.2 L29.8 20.2" stroke="#e8e2d6" strokeWidth="0.8" />
                  </svg>
                </span>
                <span className="cv-rail__garment">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="(min-width: 1280px) 234px, (min-width: 768px) 218px, 172px"
                    draggable={false}
                    unoptimized
                    priority={index < baseItems.length}
                    className={`cv-rail__img${ready.current.has(index) ? " is-ready" : ""}`}
                    placeholder="empty"
                    onLoad={(event) => revealImg(index, event.currentTarget)}
                    ref={(node) => {
                      if (node && node.complete && node.naturalWidth > 0) {
                        revealImg(index, node);
                      }
                    }}
                  />
                </span>
                <span className="cv-rail__tag">
                  <span
                    className={`cv-rail__tag-face${
                      item.comingSoon ? " is-soon" : item.soldOut ? " is-sold" : ""
                    }`}
                  >
                    {tagLabel(item, amount)}
                  </span>
                </span>
              </Link>
            );
          })}
          </div>
        </div>
      </div>

      <div className="cv-rail__foot">
        <div className="cv-rail__lead">
          <div className={`cv-rail__peek${hovered ? " is-on" : ""}`}>
            <p className="cv-rail__hint">
              <span className="cv-rail__hint-d">Hover a piece · click to look closer</span>
              <span className="cv-rail__hint-m">Swipe the rail · tap to look closer</span>
            </p>
            <div className="cv-rail__info">
              <p className="cv-rail__name">{hovered?.name ?? ""}</p>
              <p className="cv-rail__price">
                {hovered ? tagLabel(hovered, hovered.salePrice ?? hovered.price) : ""}
              </p>
            </div>
          </div>
          <p className="cv-rail__blurb">
            Crafted in heavyweight fleece.
            <br />
            Cut oversized. Made to last.
          </p>
        </div>

        <div className="cv-rail__prog" aria-hidden>
          <i ref={progRef} />
        </div>

        <Link href="/collection" className="cv-rail__cta">
          Shop the collection
        </Link>
      </div>
    </section>
  );
}
