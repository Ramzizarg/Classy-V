"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/components/StoreProvider";
import { formatPrice } from "@/lib/format";
import { firstAvailableSize, getSizeOptionsForProduct } from "@/lib/productSizesDisplay";
import { effectivePrice, isSoldOut } from "@/lib/products";
import type { Product } from "@/lib/types";

type SizeOpt = { label: string; available: boolean };

type Piece = {
  id: number;
  slug: string;
  name: string;
  image: string;
  price: number;
  salePrice: number | null;
  soldOut: boolean;
  colorway: string;
  sizes: SizeOpt[];
  x: string;
  y: string;
};

const FALLBACK_SIZE_LABELS = ["S", "M", "L", "XL"];

function fallbackSizes(soldOut: boolean): SizeOpt[] {
  return FALLBACK_SIZE_LABELS.map((label) => ({ label, available: !soldOut }));
}

type Look = {
  id: string;
  name: string;
  image: string;
  pieces: Piece[];
};

const FALLBACK_PIECES: Record<string, Omit<Piece, "x" | "y" | "sizes">> = {
  "hoodie-cropped-black": {
    id: 9,
    slug: "hoodie-cropped-black",
    name: "Hoodie Cropped Black",
    image: "https://8pz9hlket4r72cs1.public.blob.vercel-storage.com/uploads/products/1792418556469-7ho3y9.webp",
    price: 99,
    salePrice: 75,
    soldOut: false,
    colorway: "Black",
  },
  "hoodie-cropped-white": {
    id: 10,
    slug: "hoodie-cropped-white",
    name: "Hoodie Cropped White",
    image: "https://8pz9hlket4r72cs1.public.blob.vercel-storage.com/uploads/products/1792421835881-jfg5sb.webp",
    price: 99,
    salePrice: 75,
    soldOut: false,
    colorway: "White",
  },
  "baggy-jogger-black": {
    id: 7,
    slug: "baggy-jogger-black",
    name: "Baggy Jogger Black",
    image: "https://8pz9hlket4r72cs1.public.blob.vercel-storage.com/uploads/products/1792281245989-9xvdj3.webp",
    price: 85,
    salePrice: 65,
    soldOut: false,
    colorway: "Black",
  },
  "baggy-jogger-grey": {
    id: 8,
    slug: "baggy-jogger-grey",
    name: "Baggy Jogger Grey",
    image: "https://8pz9hlket4r72cs1.public.blob.vercel-storage.com/uploads/products/1792283525958-sttzrc.webp",
    price: 85,
    salePrice: 65,
    soldOut: false,
    colorway: "Grey",
  },
  "vandal-tee-black": {
    id: 4,
    slug: "vandal-tee-black",
    name: "VANDAL TEE - Black",
    image: "/uploads/products/1786816146722-1zxvsz.webp",
    price: 89.99,
    salePrice: 75,
    soldOut: true,
    colorway: "Black",
  },
  "violet-tee-purple": {
    id: 5,
    slug: "violet-tee-purple",
    name: "VIOLET TEE - Purple",
    image: "/uploads/products/1786817522827-yzije4.webp",
    price: 89.99,
    salePrice: 75,
    soldOut: true,
    colorway: "Purple",
  },
};

const LOOK_PLAN: { id: string; name: string; image: string; top: string; bottom: string }[] = [
  { id: "night-walk", name: "Night Walk", image: "/images/looks/night-walk.png", top: "hoodie-cropped-black", bottom: "baggy-jogger-black" },
  { id: "ash-hour", name: "Ash Hour", image: "/images/looks/ash-hour.png", top: "hoodie-cropped-white", bottom: "baggy-jogger-grey" },
  { id: "vandal", name: "Vandal", image: "/images/looks/vandal.png", top: "vandal-tee-black", bottom: "baggy-jogger-black" },
  { id: "violet", name: "Violet", image: "/images/looks/violet.png", top: "violet-tee-purple", bottom: "baggy-jogger-grey" },
  { id: "crop-black", name: "Crop Black", image: "/images/looks/crop-black.png", top: "hoodie-cropped-black", bottom: "baggy-jogger-grey" },
  { id: "street-grey", name: "Street Grey", image: "/images/looks/street-grey.png", top: "hoodie-cropped-white", bottom: "baggy-jogger-black" },
];

const SPRING = 14.5;
const DAMPING = 2 * Math.sqrt(SPRING) * 0.88;
const AUTOPLAY_MS = 5600;
const VISIBLE = 2;

function catalogPiece(slug: string, products: Product[]): Omit<Piece, "x" | "y"> {
  const product = products.find((row) => row.slug === slug);
  const fallback = FALLBACK_PIECES[slug] ?? FALLBACK_PIECES["hoodie-cropped-black"];
  if (!product) {
    return { ...fallback, sizes: fallbackSizes(fallback.soldOut) };
  }
  const image = product.images.find((src) => src && !src.startsWith("/media/")) ?? fallback.image;
  const sale = effectivePrice(product);
  const soldOut = isSoldOut(product);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name.replace(/\bNoir\b/gi, "Black"),
    image,
    price: product.price,
    salePrice: sale < product.price ? sale : null,
    soldOut,
    colorway: product.colorway,
    sizes: getSizeOptionsForProduct(product).map(({ label, available }) => ({ label, available })),
  };
}

function piecePrice(piece: Piece) {
  return piece.salePrice != null && piece.salePrice < piece.price ? piece.salePrice : piece.price;
}

function wrapDelta(index: number, cur: number, count: number) {
  let delta = index - cur;
  const half = count / 2;
  while (delta > half) delta -= count;
  while (delta < -half) delta += count;
  return delta;
}

function pose(delta: number, width: number) {
  const abs = Math.abs(delta);
  const t = Math.min(abs / VISIBLE, 1);
  const ease = t * t * (3 - 2 * t);
  const spread = width * (width >= 900 ? 0.162 : 0.2);
  const x = width * 0.5 + delta * spread;
  const y = -ease * (width >= 900 ? 22 : 12);
  const scale = 1 - ease * (width >= 900 ? 0.22 : 0.18);
  const blur = ease * (width >= 900 ? 6.8 : 5.2);
  const brightness = 1 - ease * 0.28;
  const fadeStart = VISIBLE + 0.12;
  const fadeEnd = VISIBLE + 0.55;
  const opacity = abs >= fadeEnd ? 0 : abs > fadeStart ? (fadeEnd - abs) / (fadeEnd - fadeStart) : 1;
  const z = Math.round((VISIBLE + 1.2 - abs) * 100);
  return { x, y, scale, blur, brightness, opacity, z, front: abs < 0.48 };
}

export function HomeTryTheLook({ products }: { products: Product[] }) {
  const router = useRouter();
  const { addLine } = useStore();
  const looks = useMemo<Look[]>(
    () =>
      LOOK_PLAN.map((plan) => ({
        id: plan.id,
        name: plan.name,
        image: plan.image,
        pieces: [
          { ...catalogPiece(plan.top, products), x: "54%", y: "32%" },
          { ...catalogPiece(plan.bottom, products), x: "48%", y: "56%" },
        ],
      })),
    [products],
  );

  const stageRef = useRef<HTMLDivElement>(null);
  const modelsRef = useRef<(HTMLElement | null)[]>([]);
  const cur = useRef(0);
  const vel = useRef(0);
  const target = useRef(0);
  const raf = useRef(0);
  const lastTs = useRef(0);
  const widthRef = useRef(360);
  const reduce = useRef(false);
  const dragging = useRef(false);
  const pointer = useRef<{
    id: number;
    x: number;
    start: number;
    moved: boolean;
    lastX: number;
    lastT: number;
    vx: number;
  } | null>(null);
  const autoplayAt = useRef(performance.now() + AUTOPLAY_MS);
  const [index, setIndex] = useState(0);
  const [hot, setHot] = useState<number | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [chosenSize, setChosenSize] = useState<Record<number, string>>({});
  const [needSize, setNeedSize] = useState(false);
  const [paying, setPaying] = useState(false);
  const [playing, setPlaying] = useState(true);
  const pickedLen = useRef(0);

  const count = looks.length;
  const look = looks[index] ?? looks[0];
  const playingRef = useRef(playing);
  playingRef.current = playing;
  pickedLen.current = picked.length;

  const selected = look ? picked.map((pin) => look.pieces[pin]).filter(Boolean) : [];
  const payable = selected.filter((piece) => !piece.soldOut);
  const payTotal = payable.reduce((sum, piece) => sum + piecePrice(piece), 0);

  const paint = useCallback(() => {
    const width = widthRef.current;
    looks.forEach((_, i) => {
      const el = modelsRef.current[i];
      if (!el) return;
      const p = pose(wrapDelta(i, cur.current, count), width);
      el.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0) translateX(-50%) scale(${p.scale.toFixed(4)})`;
      el.style.opacity = p.opacity.toFixed(3);
      el.style.zIndex = String(p.z);
      el.style.visibility = p.opacity < 0.02 ? "hidden" : "visible";
      el.style.pointerEvents = p.front ? "auto" : p.opacity > 0.35 ? "auto" : "none";
      el.style.filter = `blur(${p.blur.toFixed(2)}px) brightness(${p.brightness.toFixed(3)})`;
      el.classList.toggle("is-front", p.front);
    });
  }, [count, looks]);

  const kick = useCallback(() => {
    if (raf.current) return;
    lastTs.current = 0;
    const tick = (t: number) => {
      const dt = lastTs.current ? Math.min(0.034, (t - lastTs.current) / 1000) : 1 / 60;
      lastTs.current = t;

      if (!dragging.current) {
        if (reduce.current) {
          cur.current = target.current;
          vel.current = 0;
        } else {
          const h = dt / 4;
          for (let i = 0; i < 4; i++) {
            const acc = -SPRING * (cur.current - target.current) - DAMPING * vel.current;
            vel.current += acc * h;
            cur.current += vel.current * h;
          }
        }
      }

      paint();

      const snapped = ((Math.round(target.current) % count) + count) % count;
      setIndex((prev) => (prev === snapped ? prev : snapped));

      const auto = playingRef.current;
      const busy =
        dragging.current ||
        Math.abs(cur.current - target.current) > 0.0008 ||
        Math.abs(vel.current) > 0.0008;

      if (auto && pickedLen.current === 0 && !dragging.current && t >= autoplayAt.current) {
        target.current += 1;
        autoplayAt.current = t + AUTOPLAY_MS;
        setHot(null);
        setPicked([]);
        setChosenSize({});
        setNeedSize(false);
      }

      if (busy || auto) {
        raf.current = requestAnimationFrame(tick);
      } else {
        raf.current = 0;
      }
    };
    raf.current = requestAnimationFrame(tick);
  }, [count, paint]);

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const measure = () => {
      widthRef.current = stageRef.current?.getBoundingClientRect().width || 360;
      paint();
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    kick();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [kick, paint]);

  const nearest = (to: number) => {
    const from = target.current;
    const a = ((from % count) + count) % count;
    let delta = to - a;
    if (delta > count / 2) delta -= count;
    if (delta < -count / 2) delta += count;
    return from + delta;
  };

  const go = (next: number) => {
    target.current = next;
    autoplayAt.current = performance.now() + AUTOPLAY_MS;
    setHot(null);
    setPicked([]);
    setChosenSize({});
    setNeedSize(false);
    kick();
  };

  const togglePin = (pin: number) => {
    const piece = look?.pieces[pin];
    if (!piece || piece.soldOut) return;
    setPicked((prev) => {
      if (prev.includes(pin)) {
        setChosenSize((sizes) => {
          const next = { ...sizes };
          delete next[pin];
          return next;
        });
        return prev.filter((n) => n !== pin);
      }
      const nextSize = firstAvailableSize(piece.sizes);
      if (nextSize) {
        setChosenSize((sizes) => ({ ...sizes, [pin]: nextSize }));
      }
      return [...prev, pin].sort((a, b) => a - b);
    });
    setHot(pin);
    setNeedSize(false);
    setPlaying(false);
    autoplayAt.current = performance.now() + AUTOPLAY_MS * 4;
  };

  const dropPin = (pin: number) => {
    setPicked((prev) => prev.filter((n) => n !== pin));
    setChosenSize((sizes) => {
      const next = { ...sizes };
      delete next[pin];
      return next;
    });
    setHot((current) => (current === pin ? null : current));
    setNeedSize(false);
  };

  const pay = () => {
    if (!look || paying || payable.length === 0) return;
    const missing = picked.find((pin) => {
      const piece = look.pieces[pin];
      return piece && !piece.soldOut && !chosenSize[pin];
    });
    if (missing != null) {
      setHot(missing);
      setNeedSize(true);
      return;
    }
    setPaying(true);
    for (const pin of picked) {
      const piece = look.pieces[pin];
      if (!piece || piece.soldOut) continue;
      addLine(
        {
          productId: piece.id,
          slug: piece.slug,
          name: piece.name,
          unitPrice: piecePrice(piece),
          compareAtPrice: piece.salePrice != null ? piece.price : null,
          image: piece.image,
          size: chosenSize[pin],
          colorway: piece.colorway,
          quantity: 1,
        },
        { openCart: false },
      );
    }
    router.push("/checkout");
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragging.current = true;
    const now = performance.now();
    pointer.current = {
      id: event.pointerId,
      x: event.clientX,
      start: target.current,
      moved: false,
      lastX: event.clientX,
      lastT: now,
      vx: 0,
    };
    stageRef.current?.setPointerCapture(event.pointerId);
    kick();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = pointer.current;
    if (!drag || drag.id !== event.pointerId) return;
    const now = performance.now();
    const dx = event.clientX - drag.x;
    if (Math.abs(dx) > 6) drag.moved = true;
    const dt = Math.max(8, now - drag.lastT);
    drag.vx = (event.clientX - drag.lastX) / dt;
    drag.lastX = event.clientX;
    drag.lastT = now;
    const span = Math.max(120, widthRef.current * 0.162);
    target.current = drag.start - dx / span;
    cur.current = target.current;
    vel.current = 0;
    paint();
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = pointer.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragging.current = false;
    pointer.current = null;
    const span = Math.max(120, widthRef.current * 0.162);
    const flick = Math.max(-7, Math.min(7, (-drag.vx * 1000) / span));
    vel.current = flick;
    target.current = Math.round(cur.current + flick * 0.22);
    autoplayAt.current = performance.now() + AUTOPLAY_MS;
    if (drag.moved) setHot(null);
    kick();
  };

  const onModelClick = (i: number) => {
    if (pointer.current?.moved) return;
    if (i !== index) go(nearest(i));
  };

  return (
    <section className="cv-look" aria-label="Try the Look">
      <header className="cv-look__head">
        <h2 className="cv-look__title">Try the Look.</h2>
        <p className="cv-look__sub">
          Tap 1 or 2 to pick. Pay one piece, or both when the set is complete.
        </p>
      </header>

      <div
        ref={stageRef}
        className="cv-look__stage"
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Styled looks"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            go(target.current + 1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            go(target.current - 1);
          }
        }}
      >
        {looks.map((item, i) => (
          <figure
            key={item.id}
            ref={(node) => {
              modelsRef.current[i] = node;
            }}
            className="cv-look__model"
            onClick={() => onModelClick(i)}
          >
            <div className="cv-look__figure">
              <Image
                src={item.image}
                alt={item.name}
                fill
                sizes="(min-width: 768px) 280px, 42vw"
                priority={i === 0}
                className="cv-look__img"
              />
            </div>
            <div className="cv-look__pins">
              {item.pieces.map((piece, pin) => (
                <button
                  key={piece.slug}
                  type="button"
                  className={`cv-look__pin${picked.includes(pin) && i === index && !piece.soldOut ? " is-on" : ""}${
                    hot === pin && i === index && !piece.soldOut ? " is-hot" : ""
                  }${piece.soldOut ? " is-sold" : ""}`}
                  style={{ left: piece.x, top: piece.y }}
                  aria-label={`${pin + 1}: ${piece.name}${piece.soldOut ? " — out of stock" : ""}`}
                  aria-pressed={picked.includes(pin) && i === index && !piece.soldOut}
                  aria-disabled={piece.soldOut}
                  title={piece.soldOut ? "Out of stock" : undefined}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (i !== index) {
                      go(nearest(i));
                      return;
                    }
                    togglePin(pin);
                  }}
                >
                  <span className="cv-look__pin-dot">{pin + 1}</span>
                  {piece.soldOut ? <span className="cv-look__pin-stock">Out of stock</span> : null}
                </button>
              ))}
            </div>
          </figure>
        ))}

        <button
          type="button"
          className="cv-look__nav cv-look__nav--prev"
          aria-label="Previous look"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => go(target.current - 1)}
        >
          ‹
        </button>
        <button
          type="button"
          className="cv-look__nav cv-look__nav--next"
          aria-label="Next look"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => go(target.current + 1)}
        >
          ›
        </button>

      </div>

      {picked.length > 0 && look ? (
        <div className="cv-look__dock">
          <p className="cv-look__dock-kicker">
            {picked.length === 2
              ? "Set complete"
              : "1 piece selected · tap the other number to complete the set"}
          </p>
          {picked.map((pin) => {
            const piece = look.pieces[pin];
            if (!piece) return null;
            return (
              <div key={piece.slug} className={`cv-look__dock-row${hot === pin ? " is-focus" : ""}`}>
                <span className="cv-look__dock-num">{pin + 1}</span>
                <span className="cv-look__dock-media">
                  <Image src={piece.image} alt="" width={44} height={56} className="cv-look__dock-img" />
                </span>
                <span className="cv-look__dock-copy">
                  <span className="cv-look__dock-name">{piece.name}</span>
                  {piece.soldOut ? (
                    <span className="cv-look__card-sold">Sold out</span>
                  ) : (
                    <span className="cv-look__dock-sizes" role="group" aria-label={`${piece.name} size`}>
                      {piece.sizes
                        .filter((option) => option.available || option.label === chosenSize[pin])
                        .slice(0, 6)
                        .map((option) => (
                          <button
                            key={option.label}
                            type="button"
                            className={`cv-look__size${chosenSize[pin] === option.label ? " is-on" : ""}${
                              needSize && !chosenSize[pin] ? " is-need" : ""
                            }`}
                            disabled={!option.available}
                            onClick={() => {
                              setChosenSize((sizes) => ({ ...sizes, [pin]: option.label }));
                              setNeedSize(false);
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                    </span>
                  )}
                </span>
                <span className="cv-look__dock-price">
                  {piece.soldOut ? "—" : formatPrice(piecePrice(piece))}
                </span>
                <button
                  type="button"
                  className="cv-look__dock-x"
                  aria-label={`Remove ${piece.name}`}
                  onClick={() => dropPin(pin)}
                >
                  ×
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="cv-look__pay"
            disabled={paying || payable.length === 0}
            onClick={pay}
          >
            {payable.length === 2 ? "Pay the look" : "Pay now"}
            {payable.length > 0 ? ` · ${formatPrice(payTotal)}` : ""}
          </button>
        </div>
      ) : null}

      <div className="cv-look__bar">
        <div className="cv-look__dots" role="tablist" aria-label="Looks">
          {looks.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Look ${i + 1}: ${item.name}`}
              className={`cv-look__dot${i === index ? " is-on" : ""}`}
              onClick={() => go(nearest(i))}
            />
          ))}
        </div>
        <button
          type="button"
          className={`cv-look__play${playing ? " is-on" : ""}`}
          aria-pressed={playing}
          aria-label={playing ? "Pause autoplay" : "Play autoplay"}
          onClick={() => {
            setPlaying((on) => !on);
            autoplayAt.current = performance.now() + AUTOPLAY_MS;
            kick();
          }}
        >
          {playing ? "❚❚" : "▶"}
        </button>
      </div>

    </section>
  );
}
