"use client";

import { useId, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Plus,
  Sparkles,
  StickyNote,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { SizeGuideContent } from "@/components/SizeGuideContent";
import {
  chartSupportsFinder,
  COMMON_SIZES,
  recommendSize,
  sizeChartProblems,
  standardBodyRange,
  type BodyRange,
  type FitPreference,
  type Gender,
  type SizeChart,
} from "@/lib/sizeCharts";

type Tab = "table" | "finder" | "notes" | "preview";
type Row = SizeChart["rows"][number];
export type SizeChartUpdate = (fn: (current: SizeChart) => SizeChart) => void;

const TABS: { id: Tab; label: string; short: string; icon: typeof Table2 }[] = [
  { id: "table", label: "Measurements", short: "Table", icon: Table2 },
  { id: "finder", label: "Size finder", short: "Finder", icon: Sparkles },
  { id: "notes", label: "Notes", short: "Notes", icon: StickyNote },
  { id: "preview", label: "Customer preview", short: "Preview", icon: Eye },
];

const MAX_COLUMNS = 8;
const MAX_ROWS = 20;

export const sizeInputClass =
  "w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-black outline-none transition-colors focus:border-black";
export const sizeLabelClass = "block text-xs font-semibold uppercase tracking-wider text-black";
export const sizeGhostButton =
  "inline-flex items-center gap-1.5 rounded border border-zinc-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-700 transition-colors hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-40";
const cellInputClass =
  "w-full min-w-0 max-w-full rounded border border-zinc-200 bg-white px-1.5 py-1 text-[13px] text-black outline-none transition-colors placeholder:text-zinc-300 focus:border-black";
const iconButton =
  "inline-flex h-7 w-7 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-black disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent";

export function SizeSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-black" : "bg-zinc-300"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/** Measurements grid, finder ranges, notes and a live customer preview for one chart. */
export function SizeChartEditor({
  chart,
  onChange,
  previewNote,
}: {
  chart: SizeChart;
  onChange: SizeChartUpdate;
  previewNote?: string;
}) {
  const [tab, setTab] = useState<Tab>("table");
  const ids = useId();
  const problems = useMemo(() => sizeChartProblems(chart), [chart]);

  const duplicateSizes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of chart.rows) {
      const key = row.size.trim().toUpperCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [chart]);

  const updateRow = (index: number, fn: (row: Row) => Row) =>
    onChange((current) => ({
      ...current,
      rows: current.rows.map((row, i) => (i === index ? fn(row) : row)),
    }));

  const addColumn = () =>
    onChange((current) => ({
      ...current,
      columns: [...current.columns, `Column ${current.columns.length + 1}`],
      rows: current.rows.map((row) => ({ ...row, values: [...row.values, ""] })),
    }));

  const removeColumn = (index: number) =>
    onChange((current) => ({
      ...current,
      columns: current.columns.filter((_, i) => i !== index),
      rows: current.rows.map((row) => ({ ...row, values: row.values.filter((_, i) => i !== index) })),
    }));

  const moveColumn = (index: number, delta: number) =>
    onChange((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.columns.length) return current;
      const swap = <T,>(list: T[]) => {
        const next = [...list];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      };
      return {
        ...current,
        columns: swap(current.columns),
        rows: current.rows.map((row) => ({ ...row, values: swap(row.values) })),
      };
    });

  const addRow = (size = "") =>
    onChange((current) => ({
      ...current,
      rows: [...current.rows, { size, values: current.columns.map(() => ""), ...standardBodyRange(size) }],
    }));

  const removeRow = (index: number) =>
    onChange((current) => ({ ...current, rows: current.rows.filter((_, i) => i !== index) }));

  const moveRow = (index: number, delta: number) =>
    onChange((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.rows.length) return current;
      const rows = [...current.rows];
      [rows[index], rows[target]] = [rows[target], rows[index]];
      return { ...current, rows };
    });

  const missingSizes = COMMON_SIZES.filter(
    (size) => !chart.rows.some((row) => row.size.trim().toUpperCase() === size),
  );

  return (
    <div className="w-full min-w-0 max-w-full space-y-4">
      <div
        role="tablist"
        aria-label="Editor sections"
        className="flex gap-1 overflow-x-auto overscroll-x-contain rounded-xl bg-zinc-100 p-1 [scrollbar-width:none] md:flex md:overflow-visible md:rounded-none md:border-b md:border-zinc-200 md:bg-transparent md:p-0 [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
            className={`inline-flex min-w-[4.25rem] flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-all md:min-w-0 md:flex-none md:flex-row md:gap-1.5 md:rounded-none md:border-b-2 md:px-2.5 md:py-2 md:text-[11px] lg:gap-2 lg:px-4 lg:py-2.5 lg:text-xs ${
              tab === entry.id
                ? "bg-white text-black shadow-sm md:border-black md:bg-transparent md:shadow-none"
                : "border-transparent text-zinc-400 hover:text-zinc-600 md:bg-transparent"
            }`}
          >
            <entry.icon className="h-4 w-4 shrink-0" />
            <span className="truncate md:hidden">{entry.short}</span>
            <span className="hidden md:inline">{entry.label}</span>
          </button>
        ))}
      </div>

      {problems.length > 0 ? (
        <ul className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}

      {tab === "table" ? (
        <div className="min-w-0 space-y-4">
          <p className="text-xs leading-relaxed text-zinc-500">
            Garment measurements in centimetres. Ranges like <code className="rounded bg-zinc-100 px-1">55–57</code>{" "}
            are fine. Leave a cell empty to show a dash.
          </p>
          {/* Phones: one card per size, fields stacked so nothing is clipped. */}
          <div className="min-w-0 space-y-3 md:hidden">
            <div className="min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Columns ({chart.columns.length})
              </p>
              <div className="flex min-w-0 flex-wrap gap-2">
                {chart.columns.map((column, index) => (
                  <div
                    key={index}
                    className="flex max-w-full min-w-0 items-center rounded-full border border-zinc-300 bg-white pl-3 focus-within:border-black"
                  >
                    <input
                      aria-label={`Column ${index + 1} name`}
                      className="min-w-0 max-w-[9rem] flex-1 bg-transparent py-2 text-xs font-semibold uppercase tracking-wider text-black outline-none"
                      value={column}
                      maxLength={40}
                      onChange={(event) =>
                        onChange((current) => ({
                          ...current,
                          columns: current.columns.map((c, i) => (i === index ? event.target.value : c)),
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removeColumn(index)}
                      aria-label={`Delete column ${column}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addColumn}
                  disabled={chart.columns.length >= MAX_COLUMNS}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-zinc-400 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-600 hover:border-black hover:text-black disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
            </div>

            {chart.rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-zinc-400">
                No sizes yet — add one below.
              </p>
            ) : null}

            {chart.rows.map((row, rowIndex) => {
              const key = row.size.trim().toUpperCase();
              const invalid = !key || (duplicateSizes.get(key) ?? 0) > 1;
              return (
                <div key={rowIndex} className="min-w-0 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <input
                      aria-label="Size name"
                      className={`h-11 w-14 shrink-0 rounded-lg border px-1 text-center text-base font-bold uppercase outline-none focus:border-black ${
                        invalid ? "border-red-400 bg-red-50" : "border-zinc-300"
                      }`}
                      value={row.size}
                      maxLength={24}
                      placeholder="M"
                      onChange={(event) => updateRow(rowIndex, (r) => ({ ...r, size: event.target.value }))}
                    />
                    <div className="ml-auto flex shrink-0 items-center">
                      <button
                        type="button"
                        className="inline-flex h-10 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-black disabled:opacity-30"
                        disabled={rowIndex === 0}
                        onClick={() => moveRow(rowIndex, -1)}
                        aria-label="Move size up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-10 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-black disabled:opacity-30"
                        disabled={rowIndex === chart.rows.length - 1}
                        onClick={() => moveRow(rowIndex, 1)}
                        aria-label="Move size down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-10 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        onClick={() => removeRow(rowIndex)}
                        aria-label={`Delete size ${row.size}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {chart.columns.length > 0 ? (
                    <div className="mt-3 grid min-w-0 grid-cols-1 gap-2.5">
                      {chart.columns.map((column, colIndex) => (
                        <label key={colIndex} className="flex min-w-0 items-center gap-3">
                          <span className="w-[5.5rem] shrink-0 truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                            {column || `Col ${colIndex + 1}`}
                          </span>
                          <input
                            className="h-11 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-center text-base tabular-nums text-black outline-none placeholder:text-zinc-300 focus:border-black"
                            value={row.values[colIndex] ?? ""}
                            maxLength={24}
                            inputMode="decimal"
                            placeholder="—"
                            onChange={(event) =>
                              updateRow(rowIndex, (r) => {
                                const values = chart.columns.map((_, i) => r.values[i] ?? "");
                                values[colIndex] = event.target.value;
                                return { ...r, values };
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 md:block">
            <table
              className="w-full table-fixed border-collapse text-sm"
              style={{ minWidth: `${108 + chart.columns.length * 62}px` }}
            >
              <colgroup>
                <col className="w-[72px] lg:w-24" />
                {chart.columns.map((_, index) => (
                  <col key={index} />
                ))}
                <col className="w-9" />
              </colgroup>
              <thead>
                <tr className="bg-zinc-50">
                  <th className="px-2 py-2 text-left align-bottom text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Size
                  </th>
                  {chart.columns.map((column, index) => (
                    <th key={index} className="group/col px-1 py-1.5 align-bottom lg:px-1.5">
                      <div className="mb-1 flex items-center justify-center gap-px opacity-60 transition-opacity group-hover/col:opacity-100 group-focus-within/col:opacity-100">
                        <button
                          type="button"
                          className={iconButton}
                          disabled={index === 0}
                          onClick={() => moveColumn(index, -1)}
                          aria-label="Move column left"
                        >
                          <ArrowLeft className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className={`${iconButton} hover:!bg-red-50 hover:!text-red-600`}
                          onClick={() => removeColumn(index)}
                          aria-label={`Delete column ${column}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className={iconButton}
                          disabled={index === chart.columns.length - 1}
                          onClick={() => moveColumn(index, 1)}
                          aria-label="Move column right"
                        >
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                      <input
                        aria-label={`Column ${index + 1} name`}
                        className={`${cellInputClass} border-transparent bg-transparent text-[11px] font-semibold uppercase tracking-wider text-zinc-600 hover:border-zinc-300 focus:bg-white`}
                        value={column}
                        maxLength={40}
                        onChange={(event) =>
                          onChange((current) => ({
                            ...current,
                            columns: current.columns.map((c, i) => (i === index ? event.target.value : c)),
                          }))
                        }
                      />
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((row, rowIndex) => {
                  const key = row.size.trim().toUpperCase();
                  const invalid = !key || (duplicateSizes.get(key) ?? 0) > 1;
                  return (
                    <tr key={rowIndex} className="group/row border-t border-zinc-100 hover:bg-zinc-50/70">
                      <td className="px-1.5 py-1">
                        <div className="flex items-center gap-0.5">
                          <div className="flex flex-col opacity-40 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100">
                            <button
                              type="button"
                              className={`${iconButton} !h-4 !w-4`}
                              disabled={rowIndex === 0}
                              onClick={() => moveRow(rowIndex, -1)}
                              aria-label="Move size up"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              className={`${iconButton} !h-4 !w-4`}
                              disabled={rowIndex === chart.rows.length - 1}
                              onClick={() => moveRow(rowIndex, 1)}
                              aria-label="Move size down"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </div>
                          <input
                            aria-label="Size name"
                            className={`${cellInputClass} font-bold uppercase ${invalid ? "!border-red-400 bg-red-50" : ""}`}
                            value={row.size}
                            maxLength={24}
                            placeholder="M"
                            onChange={(event) => updateRow(rowIndex, (r) => ({ ...r, size: event.target.value }))}
                          />
                        </div>
                      </td>
                      {chart.columns.map((column, colIndex) => (
                        <td key={colIndex} className="px-1 py-1 lg:px-1.5">
                          <input
                            aria-label={`${row.size || "Size"} ${column}`}
                            className={`${cellInputClass} text-center tabular-nums`}
                            value={row.values[colIndex] ?? ""}
                            maxLength={24}
                            inputMode="decimal"
                            placeholder="—"
                            onChange={(event) =>
                              updateRow(rowIndex, (r) => {
                                const values = chart.columns.map((_, i) => r.values[i] ?? "");
                                values[colIndex] = event.target.value;
                                return { ...r, values };
                              })
                            }
                          />
                        </td>
                      ))}
                      <td className="py-1 pr-1 text-right">
                        <button
                          type="button"
                          className={`${iconButton} opacity-50 group-hover/row:opacity-100 hover:!bg-red-50 hover:!text-red-600`}
                          onClick={() => removeRow(rowIndex)}
                          aria-label={`Delete size ${row.size}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {chart.rows.length === 0 ? (
              <p className="border-t border-zinc-100 px-3 py-6 text-center text-xs text-zinc-400">
                No sizes yet — add one below.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => addRow()}
              disabled={chart.rows.length >= MAX_ROWS}
              className={`${sizeGhostButton} h-11 rounded-lg px-4 md:h-auto md:rounded md:px-3 md:py-1.5`}
            >
              <Plus className="h-3.5 w-3.5" />
              Add size
            </button>
            <button
              type="button"
              onClick={addColumn}
              disabled={chart.columns.length >= MAX_COLUMNS}
              className={`${sizeGhostButton} hidden md:inline-flex`}
            >
              <Plus className="h-3.5 w-3.5" />
              Column
            </button>
            {missingSizes.length > 0 && chart.rows.length < MAX_ROWS ? (
              <div className="flex flex-wrap items-center gap-1.5 md:ml-auto">
                <span className="text-[10px] uppercase tracking-wider text-zinc-400">Quick add</span>
                {missingSizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => addRow(size)}
                    className="rounded border border-dashed border-zinc-300 px-1.5 py-0.5 text-[11px] font-bold text-zinc-600 transition-colors hover:border-black hover:bg-white hover:text-black"
                  >
                    {size}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "finder" ? <FinderEditor chart={chart} updateRow={updateRow} /> : null}

      {tab === "notes" ? (
        <div className="grid gap-5">
          <div className="space-y-1.5">
            <label htmlFor={`${ids}-fit`} className={sizeLabelClass}>
              Fit note
            </label>
            <input
              id={`${ids}-fit`}
              className={sizeInputClass}
              value={chart.fitNote}
              maxLength={240}
              placeholder="Oversized fit. Size down for a closer fit."
              onChange={(event) => onChange((current) => ({ ...current, fitNote: event.target.value }))}
            />
            <p className="text-[11px] text-zinc-400">Shown under the recommended size.</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${ids}-how`} className={sizeLabelClass}>
              How to measure
            </label>
            <textarea
              id={`${ids}-how`}
              rows={6}
              className={`${sizeInputClass} resize-y leading-relaxed`}
              value={chart.howToMeasure.join("\n")}
              onChange={(event) =>
                onChange((current) => ({ ...current, howToMeasure: event.target.value.split("\n").slice(0, 10) }))
              }
            />
            <p className="text-[11px] text-zinc-400">One tip per line (up to 10).</p>
          </div>
        </div>
      ) : null}

      {tab === "preview" ? (
        <div className="space-y-2">
          {previewNote ? <p className="text-xs text-zinc-500">{previewNote}</p> : null}
          {chart.enabled && chart.rows.length > 0 ? (
            <div className="size-preview mx-auto max-w-4xl min-w-0 border border-zinc-800">
              <div className="border-b border-line px-3 py-2.5">
                <span className="ui font-bold">Size guide — {chart.title}</span>
              </div>
              <div className="px-3 pb-4">
                <SizeGuideContent
                  key={`${chart.slug}-${chart.finderEnabled}`}
                  chart={{ ...chart, howToMeasure: chart.howToMeasure.filter((line) => line.trim()) }}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
              The size guide is turned off, so customers won&apos;t see it.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FinderEditor({
  chart,
  updateRow,
}: {
  chart: SizeChart;
  updateRow: (index: number, fn: (row: Row) => Row) => void;
}) {
  const [gender, setGender] = useState<Gender>("men");
  const [test, setTest] = useState({ height: 178, weight: 72 });

  const setRange = (index: number, key: keyof BodyRange, raw: string) => {
    const value = raw === "" ? null : Number(raw);
    updateRow(index, (row) => ({
      ...row,
      [gender]: { ...row[gender], [key]: value !== null && Number.isFinite(value) ? value : null },
    }));
  };

  const fillStandard = () =>
    chart.rows.forEach((row, index) => {
      const standard = standardBodyRange(row.size)[gender];
      if (standard.heightMin !== null) updateRow(index, (r) => ({ ...r, [gender]: standard }));
    });

  const supported = chartSupportsFinder(chart);
  const results = (["slim", "regular", "loose"] as FitPreference[]).map((fit) => ({
    fit,
    result: supported ? recommendSize(chart, { gender, height: test.height, weight: test.weight, fit }) : null,
  }));

  const numberInput = (index: number, key: keyof BodyRange, placeholder: string, tall = false) => (
    <input
      type="number"
      inputMode="numeric"
      aria-label={`${chart.rows[index].size} ${key}`}
      className={`${cellInputClass} min-w-0 text-center tabular-nums ${
        tall ? "h-11 w-full rounded-lg text-base" : "w-12 sm:w-16"
      }`}
      value={chart.rows[index][gender][key] ?? ""}
      placeholder={placeholder}
      onChange={(event) => setRange(index, key, event.target.value)}
    />
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_240px] lg:gap-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded border border-zinc-300 p-0.5">
            {(["men", "women"] as Gender[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setGender(option)}
                className={`rounded-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  gender === option ? "bg-black text-white" : "text-zinc-500 hover:text-black"
                }`}
              >
                {option === "men" ? "Men" : "Women"}
              </button>
            ))}
          </div>
          <button type="button" onClick={fillStandard} className={sizeGhostButton}>
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Fill standard ranges</span>
            <span className="sm:hidden">Fill standard</span>
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          Body height (cm) and weight (kg) each size fits. The finder picks the closest size, so ranges can
          overlap. Leave a size empty to skip it.
        </p>

        {!chart.finderEnabled ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            The size finder is off — customers only see the table.
          </p>
        ) : null}

        <div className="space-y-2.5 sm:hidden">
          {chart.rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-zinc-400">
              Add sizes in the Measurements tab first.
            </p>
          ) : null}
          {chart.rows.map((row, index) => (
            <div key={index} className="min-w-0 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-sm">
              <p className="mb-3 text-sm font-bold uppercase text-black">{row.size || "—"}</p>
              <div className="grid min-w-0 grid-cols-1 gap-3">
                <div className="min-w-0">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Height (cm)</p>
                  <div className="flex min-w-0 items-center gap-1.5">
                    {numberInput(index, "heightMin", "min", true)}
                    <span className="shrink-0 text-zinc-300">–</span>
                    {numberInput(index, "heightMax", "max", true)}
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Weight (kg)</p>
                  <div className="flex min-w-0 items-center gap-1.5">
                    {numberInput(index, "weightMin", "min", true)}
                    <span className="shrink-0 text-zinc-300">–</span>
                    {numberInput(index, "weightMax", "max", true)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 sm:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-2 text-left">Size</th>
                <th className="px-3 py-2 text-left">Height (cm)</th>
                <th className="px-3 py-2 text-left">Weight (kg)</th>
              </tr>
            </thead>
            <tbody>
              {chart.rows.map((row, index) => (
                <tr key={index} className="border-t border-zinc-100">
                  <td className="px-3 py-1.5 font-bold uppercase">{row.size || "—"}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {numberInput(index, "heightMin", "min")}
                      <span className="text-zinc-300">–</span>
                      {numberInput(index, "heightMax", "max")}
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {numberInput(index, "weightMin", "min")}
                      <span className="text-zinc-300">–</span>
                      {numberInput(index, "weightMax", "max")}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="h-fit space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-black">
          <Sparkles className="h-4 w-4" />
          Test the finder
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="block text-[11px] uppercase tracking-wider text-zinc-500">Height cm</span>
            <input
              type="number"
              className={`${sizeInputClass} tabular-nums`}
              value={test.height}
              onChange={(event) => setTest((t) => ({ ...t, height: Number(event.target.value) || 0 }))}
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[11px] uppercase tracking-wider text-zinc-500">Weight kg</span>
            <input
              type="number"
              className={`${sizeInputClass} tabular-nums`}
              value={test.weight}
              onChange={(event) => setTest((t) => ({ ...t, weight: Number(event.target.value) || 0 }))}
            />
          </label>
        </div>
        {supported ? (
          <ul className="divide-y divide-zinc-200 rounded border border-zinc-200 bg-white">
            {results.map(({ fit, result }) => (
              <li key={fit} className="flex items-center justify-between px-3 py-2">
                <span className="text-xs uppercase tracking-wider text-zinc-500">
                  {fit === "slim" ? "Fitted" : fit === "loose" ? "Oversized" : "Regular"}
                </span>
                <span className="text-base font-bold">
                  {result?.size ?? "—"}
                  {result?.alternative ? (
                    <span className="ml-1 text-xs font-normal text-zinc-400">/ {result.alternative}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-zinc-500">Fill at least one size&apos;s ranges to test.</p>
        )}
        <p className="text-[11px] text-zinc-400">{gender === "men" ? "Men" : "Women"} ranges · live, before saving.</p>
      </aside>
    </div>
  );
}
