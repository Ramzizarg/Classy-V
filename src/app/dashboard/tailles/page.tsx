"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Eye, LayoutTemplate, Ruler, RotateCcw, Save, Undo2, X } from "lucide-react";
import {
  SizeChartEditor,
  sizeGhostButton,
  sizeInputClass,
  sizeLabelClass,
  SizeSwitch,
} from "@/components/SizeChartEditor";
import { sizeChartProblems, standardSizeChart, STANDARD_TEMPLATES, type SizeChart } from "@/lib/sizeCharts";

function StatusChip({ chart }: { chart: SizeChart }) {
  if (!chart.enabled) {
    return <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Off</span>;
  }
  if (chart.isCustom) {
    return <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Custom</span>;
  }
  return <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">Standard</span>;
}

const sameChart = (a: SizeChart, b: SizeChart) => JSON.stringify(a) === JSON.stringify(b);

export default function DashboardSizesPage() {
  const [charts, setCharts] = useState<SizeChart[]>([]);
  const [drafts, setDrafts] = useState<Record<string, SizeChart>>({});
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/backoffice/size-charts", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as { charts?: SizeChart[]; error?: string } | null;
        if (!res.ok || !data?.charts) throw new Error(data?.error || "Could not load size charts.");
        const loaded = data.charts;
        setCharts(loaded);
        setSlug((current) => current || loaded[0]?.slug || "");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load size charts."))
      .finally(() => setLoading(false));
  }, []);

  const original = charts.find((chart) => chart.slug === slug) ?? null;
  const chart = (slug && drafts[slug]) || original;
  const dirtySlugs = useMemo(
    () =>
      new Set(
        Object.entries(drafts)
          .filter(([key, draft]) => {
            const saved = charts.find((entry) => entry.slug === key);
            return saved ? !sameChart(saved, draft) : false;
          })
          .map(([key]) => key),
      ),
    [charts, drafts],
  );
  const dirty = dirtySlugs.has(slug);
  const problems = useMemo(() => (chart ? sizeChartProblems(chart) : []), [chart]);

  useEffect(() => {
    if (dirtySlugs.size === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtySlugs]);

  const update = (fn: (current: SizeChart) => SizeChart) => {
    if (!chart) return;
    setSavedSlug(null);
    setDrafts((current) => ({ ...current, [chart.slug]: fn(current[chart.slug] ?? chart) }));
  };

  const applyTemplate = (key: string) => {
    if (!chart) return;
    const template = standardSizeChart(chart.slug, chart.title, key);
    update((current) => ({ ...template, enabled: true, isCustom: current.isCustom, updatedAt: current.updatedAt }));
  };

  const discard = () => {
    if (!chart) return;
    setDrafts((current) => {
      const next = { ...current };
      delete next[chart.slug];
      return next;
    });
  };

  const replaceSaved = (next: SizeChart) => {
    setCharts((current) => current.map((entry) => (entry.slug === next.slug ? next : entry)));
    setDrafts((current) => {
      const copy = { ...current };
      delete copy[next.slug];
      return copy;
    });
  };

  const save = async () => {
    if (!chart || problems.length > 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/size-charts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chart }),
      });
      const data = (await res.json().catch(() => null)) as { chart?: SizeChart; error?: string } | null;
      if (!res.ok || !data?.chart) throw new Error(data?.error || "Could not save the size chart.");
      replaceSaved(data.chart);
      setSavedSlug(data.chart.slug);
      window.setTimeout(() => setSavedSlug((current) => (current === data.chart?.slug ? null : current)), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the size chart.");
    } finally {
      setBusy(false);
    }
  };

  const resetToStandard = async () => {
    if (!chart) return;
    if (!window.confirm(`Reset "${chart.title}" to the standard size table? Your edits will be lost.`)) return;
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ slug: chart.slug, title: chart.title });
      const res = await fetch(`/api/backoffice/size-charts?${params}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as { chart?: SizeChart; error?: string } | null;
      if (!res.ok || !data?.chart) throw new Error(data?.error || "Could not reset the size chart.");
      replaceSaved(data.chart);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the size chart.");
    } finally {
      setBusy(false);
    }
  };

  const saveButton = (extra = "") => (
    <button
      type="button"
      onClick={save}
      disabled={!chart || busy || problems.length > 0 || !dirty}
      className={`inline-flex items-center justify-center gap-1.5 rounded px-5 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 disabled:cursor-not-allowed ${
        savedSlug === slug ? "bg-emerald-600 text-white" : "bg-black text-white hover:bg-zinc-800 disabled:bg-zinc-300"
      } ${extra}`}
    >
      {savedSlug === slug ? (
        <>
          <Check className="h-3.5 w-3.5" />
          Saved
        </>
      ) : (
        <>
          <Save className="h-3.5 w-3.5" />
          {busy ? "Saving…" : "Save"}
        </>
      )}
    </button>
  );

  const showMobileBar = dirty || savedSlug === slug;

  return (
    <div className={`mx-auto max-w-6xl ${showMobileBar ? "pb-24 lg:pb-0" : ""}`}>
      <div className="mb-4 flex items-start justify-between gap-3 sm:mb-8 sm:items-end">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold text-black sm:text-3xl">
            <Ruler className="h-5 w-5 shrink-0 sm:h-7 sm:w-7" />
            Size guides
          </h1>
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
            One size table per product type, with a height &amp; weight size finder.
            <span className="hidden sm:inline"> A product can override it from Products → Edit.</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/size-guide"
            target="_blank"
            aria-label="View size guide on site"
            className="inline-flex items-center gap-1.5 rounded border border-zinc-300 px-2.5 py-2 text-xs font-medium uppercase tracking-wider text-zinc-600 transition-colors hover:border-black hover:text-black sm:px-4"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">View on site</span>
          </Link>
          <div className="hidden items-center gap-2 lg:flex">
            {dirty ? (
              <button type="button" onClick={discard} className={`${sizeGhostButton} py-2`}>
                <Undo2 className="h-3.5 w-3.5" />
                Discard
              </button>
            ) : null}
            {saveButton()}
          </div>
        </div>
      </div>

      {showMobileBar ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-xs text-zinc-500">
              {savedSlug === slug ? (
                "All changes saved"
              ) : problems.length > 0 ? (
                <span className="text-amber-700">{problems[0]}</span>
              ) : (
                <>
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" />
                  Unsaved changes · {chart?.title}
                </>
              )}
            </p>
            {dirty ? (
              <button type="button" onClick={discard} className={`${sizeGhostButton} py-2`}>
                <Undo2 className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only">Discard</span>
              </button>
            ) : null}
            {saveButton("min-w-[110px]")}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="text-red-400 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <div className="h-80 animate-pulse rounded-lg bg-zinc-100" />
          <div className="h-[28rem] animate-pulse rounded-lg bg-zinc-100" />
        </div>
      ) : !chart ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          No product types yet. Add categories to your products first.
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[240px_1fr] lg:gap-6">
          {/* Phones/tablets: swipeable pills. Desktop: sticky sidebar. */}
          <nav aria-label="Product types" className="-mx-4 sm:-mx-6 lg:hidden">
            <ul className="flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {charts.map((entry) => {
                const shown = drafts[entry.slug] ?? entry;
                const active = entry.slug === slug;
                return (
                  <li key={entry.slug} className="shrink-0 snap-start">
                    <button
                      type="button"
                      onClick={() => setSlug(entry.slug)}
                      aria-current={active ? "true" : undefined}
                      className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
                        active ? "border-black bg-black text-white" : "border-zinc-300 bg-white text-zinc-700"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          dirtySlugs.has(entry.slug)
                            ? "bg-amber-500"
                            : !entry.enabled
                              ? "bg-zinc-300"
                              : entry.isCustom
                                ? "bg-emerald-500"
                                : active
                                  ? "bg-white/70"
                                  : "bg-zinc-400"
                        }`}
                      />
                      {shown.title}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-4 text-[10px] uppercase tracking-wider text-zinc-400 sm:px-6">
              <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />Custom</span>
              <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-zinc-400" />Standard</span>
              <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-zinc-300" />Off</span>
              <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />Unsaved</span>
            </p>
          </nav>

          <aside className="hidden rounded-lg border border-zinc-200 bg-white p-2 shadow-sm lg:sticky lg:top-40 lg:block">
            <p className="px-2 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Product types
            </p>
            <ul className="flex flex-col gap-1">
              {charts.map((entry) => {
                const shown = drafts[entry.slug] ?? entry;
                const active = entry.slug === slug;
                return (
                  <li key={entry.slug}>
                    <button
                      type="button"
                      onClick={() => setSlug(entry.slug)}
                      className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                        active ? "bg-black text-white" : "text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-semibold">{shown.title}</span>
                        {dirtySlugs.has(entry.slug) ? (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="Unsaved changes" />
                        ) : null}
                      </span>
                      <span className={active ? "opacity-90" : ""}>
                        <StatusChip chart={entry} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="min-w-0 space-y-4 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:space-y-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 lg:hidden">
              <h2 className="truncate text-base font-bold text-black">{chart.title}</h2>
              <StatusChip chart={original ?? chart} />
            </div>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <label htmlFor="chart-title" className={sizeLabelClass}>
                  Name shown to customers
                </label>
                <input
                  id="chart-title"
                  className={sizeInputClass}
                  value={chart.title}
                  maxLength={60}
                  onChange={(event) => update((current) => ({ ...current, title: event.target.value }))}
                />
              </div>
              <div className="flex flex-col justify-end gap-2">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="hidden h-4 w-4 text-zinc-400 md:block" />
                  <select
                    aria-label="Start from a standard table"
                    className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-700 md:flex-none md:py-1.5"
                    value=""
                    onChange={(event) => {
                      if (event.target.value) applyTemplate(event.target.value);
                    }}
                  >
                    <option value="">Start from template…</option>
                    {STANDARD_TEMPLATES.map((template) => (
                      <option key={template.key} value={template.key}>
                        {template.label}
                      </option>
                    ))}
                  </select>
                  {original?.isCustom ? (
                    <button type="button" onClick={resetToStandard} disabled={busy} className={`${sizeGhostButton} shrink-0 py-2 md:py-1.5`}>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 sm:px-4 sm:py-3">
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wider text-black">Size guide</span>
                  <span className="mt-0.5 block text-[11px] text-zinc-500">Show the link on product pages.</span>
                </span>
                <SizeSwitch
                  label="Show size guide"
                  checked={chart.enabled}
                  onChange={(enabled) => update((current) => ({ ...current, enabled }))}
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 sm:px-4 sm:py-3">
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wider text-black">Size finder</span>
                  <span className="mt-0.5 block text-[11px] text-zinc-500">Suggest a size from height & weight.</span>
                </span>
                <SizeSwitch
                  label="Enable size finder"
                  checked={chart.finderEnabled}
                  onChange={(finderEnabled) => update((current) => ({ ...current, finderEnabled }))}
                />
              </label>
            </div>

            <SizeChartEditor
              key={chart.slug}
              chart={chart}
              onChange={update}
              previewNote={`This is how customers see the size guide${dirty ? " (including your unsaved changes)" : ""}.`}
            />

            {original?.updatedAt ? (
              <p className="text-[11px] text-zinc-400">
                Last saved {new Date(original.updatedAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
