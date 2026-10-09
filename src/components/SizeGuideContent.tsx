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

type Step = "gender" | "body" | "result";

const STEPS: { id: Step; label: string }[] = [
  { id: "gender", label: "Gender" },
  { id: "body", label: "Height & weight" },
  { id: "result", label: "Your size" },
];

const GENDER_LABELS: Record<Gender, string> = { men: "Men", women: "Women" };

function GenderGlyph({ gender }: { gender: Gender }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <circle cx="12" cy="4.4" r="2.6" />
      {gender === "men" ? (
        <path d="M8.2 8.6h7.6a2 2 0 0 1 2 2v4.9h-2.1V23h-2.6v-6.6h-2.2V23H8.3v-7.5H6.2v-4.9a2 2 0 0 1 2-2Z" />
      ) : (
        <path d="M9.7 8.6h4.6a1.6 1.6 0 0 1 1.5 1.1l2.6 7.1h-2.9V23h-2.3v-5.4h-2.4V23H8.5v-6.2H5.6l2.6-7.1a1.6 1.6 0 0 1 1.5-1.1Z" />
      )}
    </svg>
  );
}

function StepIndicator({ step, onJump }: { step: Step; onJump: (step: Step) => void }) {
  const current = STEPS.findIndex((entry) => entry.id === step);
  return (
    <ol className="size-steps" aria-label="Progress">
      {STEPS.map((entry, index) => {
        const state = index < current ? "done" : index === current ? "current" : "todo";
        return (
          <li key={entry.id} data-state={state}>
            <button
              type="button"
              className="size-steps__dot"
              disabled={state !== "done"}
              onClick={() => onJump(entry.id)}
              aria-label={`${entry.label}${state === "current" ? " (current step)" : ""}`}
              aria-current={state === "current" ? "step" : undefined}
            >
              {state === "done" ? "✓" : index + 1}
            </button>
            <span className="size-steps__label ui-sm">{entry.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function NumberField({
  id,
  label,
  unit,
  value,
  min,
  max,
  showError,
  autoFocus,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  min: number;
  max: number;
  showError: boolean;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="ui-sm text-muted">
        {label}
      </label>
      <div className="size-num mt-1.5" data-error={showError}>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={3}
          placeholder={unit === "cm" ? "175" : "70"}
          value={value}
          autoFocus={autoFocus}
          aria-invalid={showError}
          aria-describedby={`${id}-hint`}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 3))}
          onBlur={onBlur}
        />
        <span className="size-num__unit ui-sm">{unit}</span>
      </div>
      <p id={`${id}-hint`} className={`ui-sm mt-1.5 ${showError ? "text-danger" : "text-muted"}`}>
        {showError ? `Enter ${min}–${max} ${unit}` : `${min}–${max} ${unit}`}
      </p>
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
  const [step, setStep] = useState<Step>("gender");
  const [gender, setGender] = useState<Gender | null>(null);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [touched, setTouched] = useState({ height: false, weight: false, submit: false });

  const h = Number(height);
  const w = Number(weight);
  const heightValid = height !== "" && h >= HEIGHT_LIMITS.min && h <= HEIGHT_LIMITS.max;
  const weightValid = weight !== "" && w >= WEIGHT_LIMITS.min && w <= WEIGHT_LIMITS.max;

  const chooseGender = (next: Gender) => {
    setGender(next);
    if (!height && profile) setHeight(String(profile.height));
    if (!weight && profile) setWeight(String(profile.weight));
    setStep("body");
  };

  const submitBody = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched((t) => ({ ...t, submit: true }));
    if (!gender || !heightValid || !weightValid) return;
    setProfile({ gender, height: h, weight: w, fit: profile?.fit ?? DEFAULT_PROFILE.fit });
    setStep("result");
  };

  const restart = () => {
    setGender(null);
    setTouched({ height: false, weight: false, submit: false });
    setStep("gender");
  };

  const current = profile ?? DEFAULT_PROFILE;
  const recommendation: SizeRecommendation | null = useMemo(
    () => (profile ? recommendSize(chart, profile) : null),
    [chart, profile],
  );
  const availability = recommendation && productSizes ? availabilityFor(chart, recommendation.size, productSizes) : null;
  const selectable = availability?.kind === "ok" ? availability.size : availability && "nearest" in availability ? availability.nearest : null;

  return (
    <div className="mx-auto mt-4 max-w-md sm:mt-5">
      <StepIndicator step={step} onJump={setStep} />

      {step === "gender" ? (
        <div key="gender" className="size-pane text-center">
          <p className="section-title">Who are you shopping for?</p>
          <div role="radiogroup" aria-label="Gender" className="mt-5 flex justify-center gap-6 sm:gap-10">
            {(["men", "women"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={gender === option}
                className="size-gender"
                onClick={() => chooseGender(option)}
              >
                <span className="size-gender__circle">
                  <GenderGlyph gender={option} />
                </span>
                <span className="ui font-bold">{GENDER_LABELS[option]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === "body" ? (
        <form key="body" className="size-pane" onSubmit={submitBody} noValidate>
          <div className="flex items-center justify-between gap-3">
            <button type="button" className="ui-sm hover-underline text-muted" onClick={() => setStep("gender")}>
              ← Back
            </button>
            {gender ? (
              <span className="size-chip ui-sm">
                <GenderGlyph gender={gender} />
                {GENDER_LABELS[gender]}
              </span>
            ) : null}
          </div>
          <p className="section-title mt-4 text-center">Your height &amp; weight</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <NumberField
              id="size-height"
              label="Height"
              unit="cm"
              value={height}
              min={HEIGHT_LIMITS.min}
              max={HEIGHT_LIMITS.max}
              autoFocus={!height}
              showError={(touched.height || touched.submit) && !heightValid}
              onChange={setHeight}
              onBlur={() => setTouched((t) => ({ ...t, height: true }))}
            />
            <NumberField
              id="size-weight"
              label="Weight"
              unit="kg"
              value={weight}
              min={WEIGHT_LIMITS.min}
              max={WEIGHT_LIMITS.max}
              showError={(touched.weight || touched.submit) && !weightValid}
              onChange={setWeight}
              onBlur={() => setTouched((t) => ({ ...t, weight: true }))}
            />
          </div>
          <button
            type="submit"
            className="btn btn--solid ui mt-5 w-full"
            disabled={!heightValid || !weightValid}
          >
            Show my size
          </button>
        </form>
      ) : null}

      {step === "result" && !recommendation ? (
        <div key="no-result" className="size-pane text-center">
          <p className="prose-raw">
            We don&apos;t have {GENDER_LABELS[current.gender].toLowerCase()}&apos;s sizing for this piece yet — check
            the size chart instead.
          </p>
          <button type="button" className="ui-sm hover-underline mt-3 text-muted" onClick={restart}>
            Start over
          </button>
        </div>
      ) : null}

      {step === "result" && recommendation ? (
        <div key="result" className="size-pane size-result" aria-live="polite">
          <div className="flex flex-col items-center gap-2 text-center sm:gap-3">
            <p className="ui-sm text-muted">Your size</p>
            <span className="size-result__badge">{recommendation.size}</span>
            <p className="ui-sm text-muted">
              {GENDER_LABELS[current.gender]} · {current.height} cm · {current.weight} kg
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

            <div className="mt-1 w-full">
              <p className="ui-sm mb-1.5 text-muted">Preferred fit</p>
              <Segmented<FitPreference>
                label="Fit preference"
                value={current.fit}
                options={(["slim", "regular", "loose"] as const).map((fit) => ({ value: fit, label: FIT_LABELS[fit] }))}
                onChange={(fit) => setProfile({ ...current, fit })}
              />
            </div>

            {onSelectSize && selectable ? (
              <button type="button" className="btn btn--solid ui mt-1 w-full" onClick={() => onSelectSize(selectable)}>
                Select size {selectable}
              </button>
            ) : null}

            <div className="ui-sm flex items-center gap-3 text-muted">
              <button type="button" className="hover-underline" onClick={() => setStep("body")}>
                Edit height &amp; weight
              </button>
              <span aria-hidden>·</span>
              <button type="button" className="hover-underline" onClick={restart}>
                Start over
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
