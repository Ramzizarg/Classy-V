"use client";

import { useCallback, useState } from "react";
import {
  BadgeDollarSign,
  History,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { ProgressiveAdminMetrics } from "@/lib/progressivePricing";

type Props = {
  initial: ProgressiveAdminMetrics;
};

export function DashboardProgressivePricing({ initial }: Props) {
  const [metrics, setMetrics] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const state = metrics.state;
  const [enabled, setEnabled] = useState(state.enabled);
  const [basePrice, setBasePrice] = useState(String(state.basePrice));
  const [interval, setInterval] = useState(String(state.milestoneInterval));
  const [increment, setIncrement] = useState(String(state.priceIncrement));
  const [offset, setOffset] = useState(String(state.manualOrderOffset));
  const [note, setNote] = useState("");

  const syncForm = useCallback((next: ProgressiveAdminMetrics) => {
    setMetrics(next);
    setEnabled(next.state.enabled);
    setBasePrice(String(next.state.basePrice));
    setInterval(String(next.state.milestoneInterval));
    setIncrement(String(next.state.priceIncrement));
    setOffset(String(next.state.manualOrderOffset));
  }, []);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/backoffice/progressive-pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        metrics?: ProgressiveAdminMetrics;
      };
      if (!res.ok || !payload.metrics) {
        setError(payload.error ?? "Update failed.");
        return;
      }
      syncForm(payload.metrics);
      setNote("");
      setMessage("Saved.");
    } catch {
      setError("Connection lost. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveConfig = () =>
    void patch({
      enabled,
      basePrice: Number(basePrice),
      milestoneInterval: Number(interval),
      priceIncrement: Number(increment),
      manualOrderOffset: Number(offset),
      note: note.trim() || undefined,
    });

  const recalculate = () => void patch({ action: "recalculate" });

  const previewNext = state.currentPrice + state.priceIncrement;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Pricing
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight text-black sm:text-3xl">
          Progressive hoodie pricing
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600">
          Every {state.milestoneInterval} successfully delivered hoodie orders add{" "}
          {formatPrice(state.priceIncrement)}. Only delivered / DELIVERED orders count —
          cancelled, rejected and returns never do.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Delivered hoodie orders" value={String(state.deliveredOrders)} />
        <Kpi label="Current price" value={formatPrice(state.currentPrice)} />
        <Kpi label="Level" value={`L${state.level}`} />
        <Kpi
          label="Until next increase"
          value={`${state.remaining} / next ${formatPrice(state.nextPrice)}`}
        />
        <Kpi label="Hoodie revenue" value={formatPrice(metrics.hoodieRevenue)} />
        <Kpi label="AOV (hoodie)" value={formatPrice(metrics.averageOrderValue)} />
        <Kpi label="Contribution est." value={formatPrice(metrics.contributionEstimate)} />
        <Kpi
          label="Engine"
          value={state.enabled ? "Enabled" : "Disabled"}
          tone={state.enabled ? "ok" : "warn"}
        />
      </section>

      <p className="text-xs text-zinc-500">{metrics.contributionNote}</p>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BadgeDollarSign className="h-4 w-4 text-zinc-700" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">Parameters</h2>
          </div>

          <label className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-3">
            <span className="text-sm font-medium text-zinc-800">Enable progressive pricing</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 accent-black"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Initial price (DT)" value={basePrice} onChange={setBasePrice} />
            <Field label="Milestone interval" value={interval} onChange={setInterval} />
            <Field label="Price increment (DT)" value={increment} onChange={setIncrement} />
            <Field
              label="Manual order offset"
              value={offset}
              onChange={setOffset}
              hint="Positive or negative. Audited. Does not rewrite past orders."
            />
          </div>

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Audit note
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
              placeholder="Why this change?"
            />
          </label>

          <div className="mt-4 rounded-xl bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
            <p className="font-semibold text-black">Preview next milestone</p>
            <p className="mt-1">
              Effective delivered: <span className="tabular-nums">{state.effectiveDelivered}</span> →
              progress {state.progressInLevel}/{state.milestoneInterval}. After the next{" "}
              {state.remaining} qualifying order{state.remaining === 1 ? "" : "s"}, price becomes{" "}
              <span className="font-semibold tabular-nums">{formatPrice(previewNext)}</span>.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={saveConfig}
              className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save parameters
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={recalculate}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" />
              Recalculate safely
            </button>
          </div>

          {message ? <p className="mt-3 text-sm font-medium text-emerald-700">{message}</p> : null}
          {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-zinc-700" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-black">
                Conversion by price
              </h2>
            </div>
            {metrics.conversionByLevel.length === 0 ? (
              <p className="text-sm text-zinc-500">No hoodie order lines yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs uppercase tracking-wider text-zinc-500">
                      <th className="py-2 pr-3">Level</th>
                      <th className="py-2 pr-3">Price</th>
                      <th className="py-2 pr-3">Orders</th>
                      <th className="py-2 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.conversionByLevel.map((row) => (
                      <tr key={`${row.level}-${row.price}`} className="border-b border-zinc-100">
                        <td className="py-2 pr-3 tabular-nums">L{row.level}</td>
                        <td className="py-2 pr-3 tabular-nums">{formatPrice(row.price)}</td>
                        <td className="py-2 pr-3 tabular-nums">{row.orders}</td>
                        <td className="py-2 text-right tabular-nums font-semibold">
                          {formatPrice(row.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <History className="h-4 w-4 text-zinc-700" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-black">
                Pricing history
              </h2>
            </div>
            {metrics.levels.length === 0 ? (
              <p className="text-sm text-zinc-500">No milestone records yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {metrics.levels.map((level) => (
                  <li
                    key={level.level}
                    className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2"
                  >
                    <span>
                      L{level.level} · {formatPrice(level.price)}
                      <span className="ml-2 text-xs text-zinc-500">
                        @ {level.deliveredOrdersAt} delivered
                      </span>
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(level.createdAt).toLocaleString("en-GB")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-black">Audit log</h2>
        {metrics.audit.length === 0 ? (
          <p className="text-sm text-zinc-500">No audited changes yet.</p>
        ) : (
          <ul className="space-y-3">
            {metrics.audit.map((entry) => (
              <li key={entry.id} className="border-b border-zinc-100 pb-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-black">{entry.action}</span>
                  <span className="text-xs text-zinc-500">
                    {new Date(entry.createdAt).toLocaleString("en-GB")}
                    {entry.actor ? ` · ${entry.actor}` : ""}
                  </span>
                </div>
                {entry.note ? <p className="mt-1 text-zinc-600">{entry.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-lg font-extrabold tabular-nums ${
          tone === "warn" ? "text-amber-700" : tone === "ok" ? "text-emerald-700" : "text-black"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
      />
      {hint ? <span className="mt-1 block text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
}
