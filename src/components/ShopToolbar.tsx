"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { formatPrice } from "@/lib/format";

/**
 * Listing filters: size chips + a max-price slider.
 * Both write the URL so results stay server-rendered and shareable.
 */
export function ShopToolbar({
  sizes,
  priceMin,
  priceMax,
}: {
  sizes: string[];
  priceMin: number;
  priceMax: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const size = params.get("size") ?? "";
  const maxParam = params.get("max");
  const urlMax = maxParam != null && Number.isFinite(Number(maxParam)) ? Number(maxParam) : null;

  const hasRange = Number.isFinite(priceMin) && Number.isFinite(priceMax) && priceMax > priceMin;
  const sliderMax = hasRange ? Math.ceil(priceMax) : 0;
  const sliderMin = hasRange ? Math.floor(priceMin) : 0;

  const [draftMax, setDraftMax] = useState<number>(() =>
    urlMax != null ? clamp(urlMax, sliderMin, sliderMax) : sliderMax,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the thumb in sync when the URL changes (back/forward, clear, etc.).
  useEffect(() => {
    if (!hasRange) return;
    setDraftMax(urlMax != null ? clamp(urlMax, sliderMin, sliderMax) : sliderMax);
  }, [urlMax, hasRange, sliderMin, sliderMax]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const filtered = Boolean(size || (urlMax != null && urlMax < sliderMax));
  const priceActive = hasRange && draftMax < sliderMax;

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Drop unused controls so old links stay clean.
    next.delete("stock");
    next.delete("sort");
    const query = next.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  const commitMax = (value: number) => {
    if (!hasRange) return;
    const next = clamp(Math.round(value), sliderMin, sliderMax);
    setDraftMax(next);
    // At the top of the range = no filter.
    update({ max: next >= sliderMax ? null : String(next) });
  };

  const onSliderInput = (raw: string) => {
    if (!hasRange) return;
    const next = clamp(Number(raw), sliderMin, sliderMax);
    setDraftMax(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      update({ max: next >= sliderMax ? null : String(Math.round(next)) });
    }, 180);
  };

  return (
    <div className={`shop-toolbar${pending ? " is-pending" : ""}`} aria-busy={pending}>
      <div className="shop-toolbar__inner">
        <div className="shop-toolbar__block shop-toolbar__block--sizes">
          <div className="shop-toolbar__label-row">
            <span className="shop-toolbar__label">Size</span>
            {filtered ? (
              <button
                type="button"
                className="shop-toolbar__clear"
                onClick={() => {
                  setDraftMax(sliderMax);
                  update({ size: null, max: null });
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="shop-toolbar__rail shop-toolbar__rail--chips" role="group" aria-label="Filter by size">
            {sizes.map((label) => {
              const on = size.toUpperCase() === label.toUpperCase();
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  className={`shop-toolbar__chip${on ? " is-on" : ""}`}
                  onClick={() => update({ size: on ? null : label })}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {hasRange ? (
          <div className="shop-toolbar__block shop-toolbar__block--price">
            <div className="shop-toolbar__label-row">
              <span className="shop-toolbar__label">Price</span>
              <span className={`shop-toolbar__price-value${priceActive ? " is-on" : ""}`}>
                {priceActive ? `Up to ${formatPrice(draftMax)}` : "Any price"}
              </span>
            </div>
            <label className="shop-toolbar__slider">
              <span className="sr-only">Maximum price</span>
              <input
                type="range"
                min={sliderMin}
                max={sliderMax}
                step={1}
                value={draftMax}
                onChange={(event) => onSliderInput(event.target.value)}
                onPointerUp={(event) => commitMax(Number((event.target as HTMLInputElement).value))}
                onKeyUp={(event) => {
                  if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
                    commitMax(Number((event.target as HTMLInputElement).value));
                  }
                }}
                aria-valuemin={sliderMin}
                aria-valuemax={sliderMax}
                aria-valuenow={draftMax}
                aria-valuetext={priceActive ? `Up to ${formatPrice(draftMax)}` : "Any price"}
                style={
                  {
                    "--shop-slider-pct": `${((draftMax - sliderMin) / Math.max(1, sliderMax - sliderMin)) * 100}%`,
                  } as CSSProperties
                }
              />
              <span className="shop-toolbar__slider-ends" aria-hidden>
                <span>{formatPrice(sliderMin)}</span>
                <span>{formatPrice(sliderMax)}</span>
              </span>
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return max;
  return Math.min(max, Math.max(min, value));
}
