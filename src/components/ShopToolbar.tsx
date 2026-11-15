"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { formatPrice } from "@/lib/format";
import { SORT_OPTIONS } from "@/lib/products";

/** Sort + filters for the listing. Every control writes the URL, so results are server-rendered and shareable. */
export function ShopToolbar({ sizes, priceSteps }: { sizes: string[]; priceSteps: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const sort = params.get("sort") ?? "newest";
  const size = params.get("size") ?? "";
  const max = params.get("max") ?? "";
  const inStock = params.get("stock") === "in";
  const filtered = Boolean(size || max || inStock);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  return (
    <div className={`shop-toolbar${pending ? " is-pending" : ""}`} aria-busy={pending}>
      <div className="shop-toolbar__inner">
        <div className="shop-toolbar__rail shop-toolbar__rail--chips" role="group" aria-label="Filter by size and stock">
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
          <button
            type="button"
            aria-pressed={inStock}
            className={`shop-toolbar__chip shop-toolbar__chip--stock${inStock ? " is-on" : ""}`}
            onClick={() => update({ stock: inStock ? null : "in" })}
          >
            In stock
          </button>
        </div>

        <div className="shop-toolbar__rail shop-toolbar__rail--selects">
          {priceSteps.length > 0 ? (
            <label className="shop-toolbar__select">
              <span className="sr-only">Maximum price</span>
              <select value={max} onChange={(event) => update({ max: event.target.value || null })}>
                <option value="">Any price</option>
                {priceSteps.map((step) => (
                  <option key={step} value={String(step)}>
                    Up to {formatPrice(step)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="shop-toolbar__select">
            <span className="sr-only">Sort by</span>
            <select
              value={sort}
              onChange={(event) => update({ sort: event.target.value === "newest" ? null : event.target.value })}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {filtered ? (
            <button
              type="button"
              className="shop-toolbar__clear hover-underline"
              onClick={() => update({ size: null, max: null, stock: null })}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
