"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  ChevronDown,
  Clock3,
  Heart,
  Mail,
  MessageSquareText,
  Search,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  formatDropWhen,
  hoodieScoreMark,
  type HoodieNoteIntent,
  type HoodieReminderAdminRow,
} from "@/lib/hoodieReminders";
import { compareSizeLabels } from "@/lib/productSizesDisplay";

type StatusFilter = "all" | "queued" | "sent";

const SCORE_TONE: Record<number, string> = {
  0: "bg-red-50 text-red-700 border-red-200",
  2: "bg-orange-50 text-orange-700 border-orange-200",
  4: "bg-amber-50 text-amber-700 border-amber-200",
  6: "bg-lime-50 text-lime-700 border-lime-200",
  8: "bg-emerald-50 text-emerald-700 border-emerald-200",
  10: "bg-green-50 text-green-800 border-green-200",
};

function leadLabel(minutes: number) {
  if (minutes <= 0) return "At drop";
  if (minutes < 60) return `${minutes} min before`;
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    if (hours === 24) return "1 day before";
    return hours === 1 ? "1 hour before" : `${hours} hours before`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins}m before` : `${mins} min before`;
}

function intentLabel(intent: HoodieNoteIntent | null) {
  if (intent === "new") return "New like this";
  if (intent === "change") return "Change this";
  return "—";
}

function likeLabel(avg: number | null) {
  if (avg == null) return { text: "No scores", className: "border-zinc-200 bg-zinc-50 text-zinc-600" };
  if (avg >= 8) return { text: "Loved", className: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  if (avg >= 6) return { text: "Liked", className: "border-lime-200 bg-lime-50 text-lime-800" };
  if (avg >= 4) return { text: "Mixed", className: "border-amber-200 bg-amber-50 text-amber-800" };
  return { text: "Weak", className: "border-red-200 bg-red-50 text-red-700" };
}

type ProductGroup = {
  slug: string;
  name: string;
  releaseAt: string;
  reminders: HoodieReminderAdminRow[];
  waitlist: number;
  uniqueEmails: number;
  queued: number;
  sent: number;
  avgScore: number | null;
  scoreCount: number;
  sizeCounts: { size: string; count: number }[];
};

function selectClass() {
  return "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-zinc-400";
}

export function DashboardNotifyReminders({
  reminders,
  variant = "page",
}: {
  reminders: HoodieReminderAdminRow[];
  variant?: "page" | "section";
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [productFilter, setProductFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const embedded = variant === "section";

  const productOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of reminders) map.set(row.productSlug, row.productName);
    return [...map.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [reminders]);

  const sizeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of reminders) {
      if (!row.size) continue;
      if (productFilter !== "all" && row.productSlug !== productFilter) continue;
      set.add(row.size);
    }
    return [...set].sort(compareSizeLabels);
  }, [productFilter, reminders]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reminders.filter((row) => {
      const queued = !row.sentAt;
      if (status === "queued" && !queued) return false;
      if (status === "sent" && queued) return false;
      if (productFilter !== "all" && row.productSlug !== productFilter) return false;
      if (sizeFilter !== "all" && (row.size || "—") !== sizeFilter) return false;
      if (!q) return true;
      const hay = `${row.email} ${row.productName} ${row.productSlug} ${row.size} ${row.note ?? ""} ${intentLabel(row.intent)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [productFilter, query, reminders, sizeFilter, status]);

  const stats = useMemo(() => {
    const queued = filteredRows.filter((row) => !row.sentAt).length;
    const sent = filteredRows.length - queued;
    const products = new Set(filteredRows.map((row) => row.productSlug)).size;
    const scores = filteredRows.map((row) => row.score).filter((score): score is number => score != null);
    const avgScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
    return { total: filteredRows.length, waitlist: queued, queued, sent, products, avgScore, scoreCount: scores.length };
  }, [filteredRows]);

  const groups = useMemo(() => {
    const map = new Map<string, ProductGroup>();

    for (const row of filteredRows) {
      const queued = !row.sentAt;
      const current = map.get(row.productSlug);
      if (current) {
        current.reminders.push(row);
        if (queued) current.queued += 1;
        else current.sent += 1;
      } else {
        map.set(row.productSlug, {
          slug: row.productSlug,
          name: row.productName,
          releaseAt: row.releaseAt,
          reminders: [row],
          waitlist: 0,
          uniqueEmails: 0,
          queued: queued ? 1 : 0,
          sent: queued ? 0 : 1,
          avgScore: null,
          scoreCount: 0,
          sizeCounts: [],
        });
      }
    }

    const list = [...map.values()].map((group) => {
      const scores = group.reminders.map((row) => row.score).filter((score): score is number => score != null);
      const avgScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
      const waitlist = group.reminders.filter((row) => !row.sentAt).length;
      const uniqueEmails = new Set(group.reminders.map((row) => row.email)).size;
      const sizeMap = new Map<string, number>();
      for (const row of group.reminders) {
        const key = row.size || "—";
        sizeMap.set(key, (sizeMap.get(key) ?? 0) + 1);
      }
      const sizeCounts = [...sizeMap.entries()]
        .map(([size, count]) => ({ size, count }))
        .sort((a, b) => compareSizeLabels(a.size, b.size) || b.count - a.count);
      return { ...group, avgScore, scoreCount: scores.length, waitlist, uniqueEmails, sizeCounts };
    });

    list.sort(
      (a, b) =>
        b.waitlist - a.waitlist ||
        b.reminders.length - a.reminders.length ||
        (b.avgScore ?? -1) - (a.avgScore ?? -1) ||
        a.name.localeCompare(b.name),
    );
    return list;
  }, [filteredRows]);

  const hasActiveFilters =
    query.trim() !== "" || status !== "all" || productFilter !== "all" || sizeFilter !== "all";

  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setProductFilter("all");
    setSizeFilter("all");
  };

  const overallLike = likeLabel(stats.avgScore);
  const overallMark = stats.avgScore == null ? null : hoodieScoreMark(stats.avgScore);

  return (
    <div className={embedded ? "w-full min-w-0" : "mx-auto w-full min-w-0 max-w-6xl"}>
      <div
        className={`mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${
          embedded ? "mb-4" : "mb-6 sm:mb-8"
        }`}
      >
        <div>
          {embedded ? (
            <>
              <h2 className="text-base font-bold uppercase tracking-wider text-black sm:text-lg">Notify me</h2>
              <p className="mt-0.5 text-xs text-zinc-500">Waitlist, sizes, scores and reminder details.</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-black sm:text-3xl">Notify me</h1>
              <p className="mt-1 text-sm text-zinc-600">
                Complete waitlist by product and size, with average scores to see what people like.
              </p>
            </>
          )}
        </div>
        <Link
          href="/dashboard/analytiques"
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-black transition hover:bg-zinc-50"
        >
          Analytics
        </Link>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
        {[
          { label: "Waitlist now", value: String(stats.waitlist), icon: Users },
          { label: "Total signups", value: String(stats.total), icon: Bell },
          { label: "Queued", value: String(stats.queued), icon: Clock3 },
          { label: "Sent", value: String(stats.sent), icon: Send },
          { label: "Products", value: String(stats.products), icon: Sparkles },
          {
            label: "Avg score",
            value: stats.avgScore == null ? "—" : stats.avgScore.toFixed(1),
            icon: Heart,
            hint: overallMark ? `${overallMark.label} · ${overallLike.text}` : "No scores yet",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white px-3 py-3 sm:px-4 sm:py-4"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="truncate text-[10px] font-medium uppercase tracking-wider text-zinc-500 sm:text-xs">
                {item.label}
              </span>
              <item.icon className="h-4 w-4 shrink-0 text-zinc-700 sm:h-5 sm:w-5" />
            </div>
            <span className="text-2xl font-bold tabular-nums text-black sm:text-3xl">{item.value}</span>
            {"hint" in item && item.hint ? <p className="mt-1 text-[11px] text-zinc-500">{item.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative block min-w-0">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Search</span>
            <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-zinc-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Email, note, product…"
              className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-sm text-black outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
            />
          </label>

          <label className="block min-w-0">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Product</span>
            <select
              value={productFilter}
              onChange={(event) => {
                setProductFilter(event.target.value);
                setSizeFilter("all");
                setOpenSlug(event.target.value === "all" ? null : event.target.value);
              }}
              className={selectClass()}
            >
              <option value="all">All products ({productOptions.length})</option>
              {productOptions.map((product) => (
                <option key={product.slug} value={product.slug}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-0">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Size</span>
            <select value={sizeFilter} onChange={(event) => setSizeFilter(event.target.value)} className={selectClass()}>
              <option value="all">All sizes ({sizeOptions.length})</option>
              {sizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <div className="block min-w-0">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Status</span>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["queued", "Queued"],
                  ["sent", "Sent"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className={`rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition ${
                    status === key
                      ? "border-black bg-black text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-black"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {hasActiveFilters ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
            <p className="text-xs text-zinc-500">
              Showing {filteredRows.length} signup{filteredRows.length === 1 ? "" : "s"} · {groups.length} product
              {groups.length === 1 ? "" : "s"}
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-700 hover:bg-zinc-50"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          </div>
        ) : (
          <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            {filteredRows.length} signup{filteredRows.length === 1 ? "" : "s"} across {groups.length} product
            {groups.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-12 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-zinc-400" />
          <p className="text-sm font-medium text-zinc-800">No notify-me results</p>
          <p className="mt-1 text-sm text-zinc-500">
            {reminders.length === 0
              ? "When shoppers save a hoodie drop reminder, they will appear here."
              : "Try another product, size, or clear the filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const open = openSlug === group.slug || productFilter === group.slug;
            const releaseLabel = formatDropWhen(group.releaseAt);
            const avgMark = group.avgScore == null ? null : hoodieScoreMark(group.avgScore);
            const like = likeLabel(group.avgScore);

            return (
              <section key={group.slug} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <button
                  type="button"
                  onClick={() => setOpenSlug(open && productFilter !== group.slug ? null : group.slug)}
                  className="flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-zinc-50 sm:px-5"
                  aria-expanded={open}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-black sm:text-lg">{group.name}</h2>
                      <span className="rounded-full border border-black bg-black px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        {group.reminders.length} total
                      </span>
                      <span className="rounded-full border border-zinc-300 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-800">
                        {group.waitlist} waitlist
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-zinc-500">
                      /{group.slug}
                      {releaseLabel ? ` · drops ${releaseLabel}` : ""} · {group.uniqueEmails} email
                      {group.uniqueEmails === 1 ? "" : "s"}
                    </p>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Signups</p>
                        <p className="mt-1 text-xl font-bold tabular-nums text-black">{group.reminders.length}</p>
                        <p className="text-[11px] text-zinc-500">
                          {group.queued} queued · {group.sent} sent
                        </p>
                      </div>
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Average score</p>
                        <p className="mt-1 text-xl font-bold tabular-nums text-black">
                          {group.avgScore == null ? "—" : group.avgScore.toFixed(1)}
                          <span className="text-sm font-semibold text-zinc-500"> / 10</span>
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {group.scoreCount} score{group.scoreCount === 1 ? "" : "s"}
                          {avgMark ? ` · ${avgMark.label}` : ""}
                        </p>
                      </div>
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">People like it?</p>
                        <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${like.className}`}>
                          {like.text}
                        </span>
                        <p className="mt-1.5 text-[11px] text-zinc-500">Based on notify scores</p>
                      </div>
                    </div>

                    {group.sizeCounts.length ? (
                      <div className="mt-3">
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                          Waitlist by size
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {group.sizeCounts.map((entry) => (
                            <button
                              key={entry.size}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setProductFilter(group.slug);
                                setSizeFilter(entry.size);
                                setOpenSlug(group.slug);
                              }}
                              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold tabular-nums transition ${
                                sizeFilter === entry.size && productFilter === group.slug
                                  ? "border-black bg-black text-white"
                                  : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300"
                              }`}
                            >
                              {entry.size} <span className="opacity-70">· {entry.count}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-zinc-400 transition ${open ? "rotate-180" : ""}`} />
                </button>

                {open ? (
                  <div className="border-t border-zinc-100">
                    <div className="hidden overflow-x-auto md:block">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
                          <tr>
                            <th className="px-5 py-3 font-semibold">Email</th>
                            <th className="px-3 py-3 font-semibold">Size</th>
                            <th className="px-3 py-3 font-semibold">Score</th>
                            <th className="px-3 py-3 font-semibold">Feedback</th>
                            <th className="px-3 py-3 font-semibold">Note</th>
                            <th className="px-3 py-3 font-semibold">Remind</th>
                            <th className="px-3 py-3 font-semibold">Drop</th>
                            <th className="px-3 py-3 font-semibold">Status</th>
                            <th className="px-5 py-3 font-semibold">Saved</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.reminders.map((row) => {
                            const mark = hoodieScoreMark(row.score ?? 0);
                            return (
                              <tr key={row.id} className="border-t border-zinc-100 align-top">
                                <td className="px-5 py-3">
                                  <div className="flex items-start gap-2">
                                    <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                                    <a href={`mailto:${row.email}`} className="break-all font-medium text-black hover:underline">
                                      {row.email}
                                    </a>
                                  </div>
                                </td>
                                <td className="px-3 py-3">
                                  <span className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-bold text-zinc-800">
                                    {row.size || "—"}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  <span
                                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                      SCORE_TONE[mark.score] ?? "border-zinc-200 bg-zinc-50 text-zinc-700"
                                    }`}
                                  >
                                    {mark.emoji} {row.score ?? 0}/10 · {mark.label}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-xs text-zinc-700">{intentLabel(row.intent)}</td>
                                <td className="px-3 py-3">
                                  {row.note ? (
                                    <p className="max-w-[220px] text-xs leading-relaxed text-zinc-700">
                                      <MessageSquareText className="mr-1 inline h-3 w-3 text-zinc-400" />
                                      {row.note}
                                    </p>
                                  ) : (
                                    <span className="text-xs text-zinc-400">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-3">
                                  <div className="text-xs font-medium text-zinc-800">{leadLabel(row.leadMinutes)}</div>
                                  <div className="mt-0.5 text-[11px] text-zinc-500">{formatDropWhen(row.remindAt)}</div>
                                </td>
                                <td className="px-3 py-3 text-xs text-zinc-600">{formatDropWhen(row.releaseAt)}</td>
                                <td className="px-3 py-3">
                                  {row.sentAt ? (
                                    <div>
                                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                                        Sent
                                      </span>
                                      <p className="mt-1 text-[11px] text-zinc-500">{formatDropWhen(row.sentAt)}</p>
                                    </div>
                                  ) : (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                      Queued
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-3 text-xs text-zinc-500">{formatDropWhen(row.createdAt)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-2 p-3 md:hidden">
                      {group.reminders.map((row) => {
                        const mark = hoodieScoreMark(row.score ?? 0);
                        return (
                          <article key={row.id} className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <a href={`mailto:${row.email}`} className="min-w-0 break-all text-sm font-semibold text-black">
                                {row.email}
                              </a>
                              {row.sentAt ? (
                                <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                                  Sent
                                </span>
                              ) : (
                                <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                  Queued
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <span className="rounded-lg border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-800">
                                Size {row.size || "—"}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  SCORE_TONE[mark.score] ?? "border-zinc-200 bg-zinc-50 text-zinc-700"
                                }`}
                              >
                                {mark.emoji} {row.score ?? 0}/10 · {mark.label}
                              </span>
                              <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                                {intentLabel(row.intent)}
                              </span>
                            </div>
                            {row.note ? <p className="mt-2 text-xs leading-relaxed text-zinc-700">{row.note}</p> : null}
                            <div className="mt-2 space-y-1 text-[11px] text-zinc-500">
                              <p>
                                Remind {leadLabel(row.leadMinutes)} · {formatDropWhen(row.remindAt)}
                              </p>
                              <p>Drop {formatDropWhen(row.releaseAt)}</p>
                              <p>Saved {formatDropWhen(row.createdAt)}</p>
                              {row.sentAt ? <p>Sent {formatDropWhen(row.sentAt)}</p> : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
