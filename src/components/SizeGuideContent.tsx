"use client";

import { useMemo, useState } from "react";
import { useFitProfile } from "@/components/useFitProfile";
import {
  chartSupportsFinder,
  cmToInches,
  HEIGHT_LIMITS,
  recommendSize,
  WEIGHT_LIMITS,
  type FitPreference,
  type FitProfile,
  type Gender,
  type SizeChart,
  type SizeRecommendation,
} from "@/lib/sizeCharts";
import type { SizeStock } from "@/lib/types";

const DEFAULT_PROFILE: FitProfile = { gender: "men", height: 175, weight: 70, fit: "regular" };

const FIT_LABELS: Record<FitPreference, string> = {
  slim: "Fitted",
  regular: "Regular",
  loose: "Oversized",
};

type Availability =
  | { kind: "ok"; size: string }
  | { kind: "sold-out"; size: string; nearest: string | null }
  | { kind: "not-offered"; nearest: string | null };

function sameSize(a: string, b: string) {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

function orderedPair(chart: SizeChart, a: string, b: string): [string, string] {
  const index = (size: string) => chart.rows.findIndex((row) => sameSize(row.size, size));
  return index(a) <= index(b) ? [a, b] : [b, a];
}

/** Maps the chart's recommendation onto what this product actually stocks. */
function availabilityFor(
  chart: SizeChart,
  recommended: string,
  productSizes: SizeStock[],
): Availability {
  const order = chart.rows.map((row) => row.size.toUpperCase());
  const target = order.indexOf(recommended.toUpperCase());
  const nearestInStock = () => {
    let best: { size: string; distance: number } | null = null;
    for (const entry of productSizes) {
      const index = order.indexOf(entry.size.toUpperCase());
      if (entry.stock <= 0 || index < 0) continue;
      const distance = Math.abs(index - target);
      if (!best || distance < best.distance) best = { size: entry.size, distance };
    }
    return best?.size ?? null;
  };

  const match = productSizes.find((entry) => sameSize(entry.size, recommended));
  if (match) return match.stock > 0 ? { kind: "ok", size: match.size } : { kind: "sold-out", size: match.size, nearest: nearestInStock() };
  return { kind: "not-offered", nearest: nearestInStock() };
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  fit,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  fit?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`size-seg${fit ? " size-seg--fit" : ""}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          data-active={value === option.value}
          onClick={() => onChange(option.value)}
          className="size-seg__btn ui"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Slider({
  id,
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="size-field">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="ui-sm text-muted">
          {label}
        </label>
        <span className="size-field__value tabular-nums">
          {value}
          <span className="ui-sm text-muted"> {unit}</span>
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 sm:mt-2">
        <button
          type="button"
          className="size-step"
          aria-label={`Decrease ${label.toLowerCase()}`}
          onClick={() => onChange(clamp(value - 1))}
        >
          −
        </button>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(event) => onChange(clamp(Number(event.target.value)))}
          className="size-range"
          style={{ "--fill": `${fill}%` } as React.CSSProperties}
        />
        <button
          type="button"
          className="size-step"
          aria-label={`Increase ${label.toLowerCase()}`}
          onClick={() => onChange(clamp(value + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}

function SizeFinder({
  chart,
  productSizes,
  onSelectSize,
}: {
  chart: SizeChart;
  productSizes?: SizeStock[];
  onSelectSize?: (size: string) => void;
}) {
  const { profile, setProfile } = useFitProfile();
  const current = profile ?? DEFAULT_PROFILE;
  const update = (patch: Partial<FitProfile>) => setProfile({ ...current, ...patch });

  const recommendation: SizeRecommendation | null = useMemo(
    () => (profile ? recommendSize(chart, profile) : null),
    [chart, profile],
  );
  const availability = recommendation && productSizes ? availabilityFor(chart, recommendation.size, productSizes) : null;
  const selectable = availability?.kind === "ok" ? availability.size : availability && "nearest" in availability ? availability.nearest : null;

  return (
    <div className="mt-3 grid gap-3.5 sm:mt-4 sm:grid-cols-[1fr_minmax(0,0.9fr)] sm:gap-6">
      <div className="space-y-3 sm:space-y-5">
        <Segmented<Gender>
          label="Gender"
          value={current.gender}
          options={[
            { value: "men", label: "Men" },
            { value: "women", label: "Women" },
          ]}
          onChange={(gender) => update({ gender })}
        />
        <Slider
          id="size-height"
          label="Height"
          unit="cm"
          value={current.height}
          min={HEIGHT_LIMITS.min}
          max={HEIGHT_LIMITS.max}
          onChange={(height) => update({ height })}
        />
        <Slider
          id="size-weight"
          label="Weight"
          unit="kg"
          value={current.weight}
          min={WEIGHT_LIMITS.min}
          max={WEIGHT_LIMITS.max}
          onChange={(weight) => update({ weight })}
        />
        <div>
          <p className="ui-sm mb-1.5 text-muted sm:mb-2">How do you like it to fit?</p>
          <Segmented<FitPreference>
            label="Fit preference"
            value={current.fit}
            options={(["slim", "regular", "loose"] as const).map((fit) => ({ value: fit, label: FIT_LABELS[fit] }))}
            onChange={(fit) => update({ fit })}
          />
        </div>
      </div>

      <div className="size-result" aria-live="polite">
        {!recommendation ? (
          <div className="flex h-full flex-col items-center justify-center gap-2.5 py-1 text-center sm:gap-3 sm:py-6">
            <span className="size-result__badge size-result__badge--empty">?</span>
            <p className="ui text-muted">Set your height and weight to see your size.</p>
            <button type="button" className="btn btn--solid ui w-full sm:w-auto" onClick={() => setProfile(current)}>
              Find my size
            </button>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center gap-2 py-1 text-center sm:gap-3 sm:py-2">
            <p className="ui-sm text-muted">Your size</p>
            <span className="size-result__badge">{recommendation.size}</span>
            <p className="ui-sm text-muted">
              {FIT_LABELS[current.fit]} fit · {current.height} cm · {current.weight} kg
            </p>

            {recommendation.alternative ? (
              <p className="ui-sm leading-relaxed">
                Between {orderedPair(chart, recommendation.size, recommendation.alternative).join(" and ")}. Take the
                bigger one for a looser fit.
              </p>
            ) : null}
            {recommendation.outOfRange ? (
              <p className="ui-sm leading-relaxed">
                You are {recommendation.outOfRange === "below" ? "below the smallest" : "above the largest"} size in
                this chart. Check the measurements before ordering.
              </p>
            ) : null}
            {chart.fitNote ? <p className="ui-sm leading-relaxed text-muted">{chart.fitNote}</p> : null}

            {availability?.kind === "sold-out" ? (
              <p className="ui-sm leading-relaxed">
                {availability.size} is sold out
                {availability.nearest ? ` — ${availability.nearest} is the closest in stock.` : "."}
              </p>
            ) : null}
            {availability?.kind === "not-offered" ? (
              <p className="ui-sm leading-relaxed">
                This piece doesn&apos;t come in {recommendation.size}
                {availability.nearest ? ` — ${availability.nearest} is the closest.` : "."}
              </p>
            ) : null}

            {onSelectSize && selectable ? (
              <button type="button" className="btn btn--solid ui mt-auto w-full" onClick={() => onSelectSize(selectable)}>
                Select size {selectable}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function SizeChartTable({ chart, highlight }: { chart: SizeChart; highlight?: string | null }) {
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="section-title">{chart.title} — garment measurements</p>
        <Segmented<"cm" | "in">
          label="Unit"
          value={unit}
          fit
          options={[
            { value: "cm", label: "cm" },
            { value: "in", label: "in" },
          ]}
          onChange={setUnit}
        />
      </div>

      <div className="mt-3 overflow-x-auto border border-line">
        <table className="size-table w-full">
          <thead>
            <tr>
              <th scope="col" className="ui">Size</th>
              {chart.columns.map((column, i) => (
                <th key={i} scope="col" className="ui">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chart.rows.map((row, rowIndex) => {
              const mine = Boolean(highlight && sameSize(highlight, row.size));
              return (
                <tr key={rowIndex} data-mine={mine}>
                  <th scope="row" className="ui">
                    {row.size}
                    {mine ? <span className="size-table__you ui-sm">You</span> : null}
                  </th>
                  {chart.columns.map((_, i) => (
                    <td key={i} className="ui-sm tabular-nums">
                      {row.values[i] ? (unit === "in" ? cmToInches(row.values[i]) : row.values[i]) : "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="ui-sm mt-2 text-muted">Measured flat, tolerance ±1.5 cm.</p>

      {chart.howToMeasure.length > 0 ? (
        <div className="mt-5 border-t border-line pt-4">
          <p className="section-title">How to measure</p>
          <ul className="prose-raw mt-2 list-disc space-y-1 pl-4">
            {chart.howToMeasure.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Size guide body: the height/weight finder and the measurement chart. Used by the
 * product-page popup (with stock + "Select size") and the standalone size guide page.
 */
export function SizeGuideContent({
  chart,
  productSizes,
  onSelectSize,
}: {
  chart: SizeChart;
  productSizes?: SizeStock[];
  onSelectSize?: (size: string) => void;
}) {
  const finder = chartSupportsFinder(chart);
  const [tab, setTab] = useState<"finder" | "chart">(finder ? "finder" : "chart");
  const { profile } = useFitProfile();
  const recommended = finder && profile ? recommendSize(chart, profile)?.size ?? null : null;

  return (
    <div className="pt-3">
      {finder ? (
        <Segmented<"finder" | "chart">
          label="Size guide view"
          value={tab}
          options={[
            { value: "finder", label: "Find my size" },
            { value: "chart", label: "Size chart" },
          ]}
          onChange={setTab}
        />
      ) : null}

      {finder && tab === "finder" ? (
        <SizeFinder chart={chart} productSizes={productSizes} onSelectSize={onSelectSize} />
      ) : (
        <SizeChartTable chart={chart} highlight={recommended} />
      )}
    </div>
  );
}
