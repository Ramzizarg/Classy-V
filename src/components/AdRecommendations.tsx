"use client";

import { useMemo, useState } from "react";
import {
  CheckCheck,
  ChevronDown,
  CirclePause,
  CirclePlay,
  ExternalLink,
  EyeOff,
  FlaskConical,
  Lightbulb,
  Plug,
  Repeat2,
  TrendingUp,
  Undo2,
  Wrench,
} from "lucide-react";
import type { JudgedAd, RecKind, Recommendation } from "@/lib/adRecommendations";
import { adsManagerUrl, VERDICT_ORDER, type Verdict } from "@/lib/metaAds";

const STORAGE_KEY = "classyv.ads.recs.v1";
const DONE_MS = 3 * 86400000;
const DISMISS_MS = 14 * 86400000;
const INITIAL_VISIBLE = 4;

type Hidden = Record<string, { state: "done" | "dismissed"; at: number }>;

function readHidden(): Hidden {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Hidden;
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(raw).filter(([, entry]) => now - entry.at < (entry.state === "done" ? DONE_MS : DISMISS_MS)),
    );
  } catch {
    return {};
  }
}

function hiddenEntry(state: "done" | "dismissed"): Hidden[string] {
  return { state, at: Date.now() };
}

const KIND: Record<RecKind, { label: string; icon: typeof TrendingUp; tone: string }> = {
  scale: { label: "Scale", icon: TrendingUp, tone: "bg-emerald-100 text-emerald-700" },
  cut: { label: "Cut", icon: CirclePause, tone: "bg-red-100 text-red-700" },
  revive: { label: "Revive", icon: CirclePlay, tone: "bg-emerald-100 text-emerald-700" },
  refresh: { label: "Refresh", icon: Repeat2, tone: "bg-amber-100 text-amber-700" },
  fix: { label: "Fix", icon: Wrench, tone: "bg-violet-100 text-violet-700" },
  test: { label: "Test", icon: FlaskConical, tone: "bg-sky-100 text-sky-700" },
  setup: { label: "Setup", icon: Plug, tone: "bg-zinc-200 text-zinc-700" },
};

const IMPACT = {
  high: { label: "High impact", className: "bg-black text-white" },
  medium: { label: "Medium", className: "bg-zinc-100 text-zinc-700" },
  low: { label: "Low", className: "bg-zinc-50 text-zinc-500" },
} as const;

const SPLIT: Record<Verdict, { label: string; bar: string }> = {
  winner: { label: "Winning", bar: "bg-emerald-500" },
  promising: { label: "Promising", bar: "bg-sky-500" },
  testing: { label: "Testing", bar: "bg-amber-400" },
  loser: { label: "Not working", bar: "bg-red-500" },
};

export function AdRecommendations({
  rows,
  recs,
  money,
  accountId,
  demo,
  onOpenAd,
}: {
  rows: JudgedAd[];
  recs: Recommendation[];
  money: (value: number) => string;
  accountId: string;
  demo: boolean;
  onOpenAd: (id: string) => void;
}) {
  const [hidden, setHidden] = useState<Hidden>(readHidden);
  const [expanded, setExpanded] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const update = (next: Hidden) => {
    setHidden(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage full or blocked: keep it for this session only */
    }
  };
  const hide = (id: string, state: "done" | "dismissed") => update({ ...hidden, [id]: hiddenEntry(state) });
  const restore = (id: string) => {
    const next = { ...hidden };
    delete next[id];
    update(next);
  };

  const open = recs.filter((rec) => !hidden[rec.id]);
  const closed = recs.filter((rec) => hidden[rec.id]);
  const shown = expanded ? open : open.slice(0, INITIAL_VISIBLE);
  const saving = open.reduce((sum, rec) => sum + rec.savingPerDay, 0);
  const byId = useMemo(() => new Map(rows.map((row) => [row.ad.id, row])), [rows]);

  return (
    <section className="mb-6 grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <BudgetSplit rows={rows} money={money} />

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 sm:px-5">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-black">
              <Lightbulb className="h-4 w-4" />
              Recommended actions
            </h2>
            <p className="text-xs text-zinc-500">Ranked by impact, from your own numbers. Updates live when you change the rules.</p>
          </div>
          <div className="flex items-center gap-2">
            {open.length > 0 ? (
              <span className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-700">
                {open.length} to do
              </span>
            ) : null}
            {saving > 0 ? (
              <span className="rounded bg-emerald-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Save ~{money(saving)}/day
              </span>
            ) : null}
          </div>
        </div>

        {open.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCheck className="h-5 w-5" />
            </span>
            <p className="font-semibold text-black">All clear</p>
            <p className="text-sm text-zinc-500">Nothing needs your attention right now. Check back after the next refresh.</p>
          </div>
        ) : (
          <ol>
            {shown.map((rec, index) => (
              <RecItem
                key={rec.id}
                rec={rec}
                rank={index + 1}
                defaultOpen={index === 0}
                ads={rec.adIds.flatMap((id) => byId.get(id) ?? [])}
                accountId={accountId}
                demo={demo}
                onOpenAd={onOpenAd}
                onDone={() => hide(rec.id, "done")}
                onDismiss={() => hide(rec.id, "dismissed")}
              />
            ))}
          </ol>
        )}

        {open.length > INITIAL_VISIBLE || closed.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-2.5 sm:px-5">
            {open.length > INITIAL_VISIBLE ? (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-700 hover:text-black"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                {expanded ? "Show less" : `Show ${open.length - INITIAL_VISIBLE} more`}
              </button>
            ) : (
              <span />
            )}
            {closed.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowHidden((value) => !value)}
                className="text-xs text-zinc-500 hover:text-black"
              >
                {closed.length} done or dismissed · {showHidden ? "Hide" : "Show"}
              </button>
            ) : null}
          </div>
        ) : null}

        {showHidden && closed.length > 0 ? (
          <ul className="border-t border-zinc-200 bg-zinc-50">
            {closed.map((rec) => (
              <li key={rec.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm sm:px-5">
                <span className="min-w-0 truncate text-zinc-500">
                  <span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {hidden[rec.id]?.state === "done" ? "Done" : "Dismissed"}
                  </span>
                  {rec.title}
                </span>
                <button
                  type="button"
                  onClick={() => restore(rec.id)}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-black"
                >
                  <Undo2 className="h-3 w-3" />
                  Restore
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function RecItem({
  rec,
  rank,
  defaultOpen,
  ads,
  accountId,
  demo,
  onOpenAd,
  onDone,
  onDismiss,
}: {
  rec: Recommendation;
  rank: number;
  defaultOpen: boolean;
  ads: JudgedAd[];
  accountId: string;
  demo: boolean;
  onOpenAd: (id: string) => void;
  onDone: () => void;
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const kind = KIND[rec.kind];
  const Icon = kind.icon;
  const impact = IMPACT[rec.impact];

  return (
    <li className="flex gap-3 border-t border-zinc-100 px-4 py-4 first:border-t-0 sm:gap-4 sm:px-5">
      <div className="flex flex-col items-center gap-1">
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${kind.tone}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[10px] font-bold text-zinc-300">#{rank}</span>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="min-w-0 font-semibold leading-snug text-black">{rec.title}</p>
          <div className="flex shrink-0 items-center gap-1">
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{kind.label}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${impact.className}`}>{impact.label}</span>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-zinc-600">{rec.detail}</p>

        {rec.gain ? (
          <span className="inline-flex rounded bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{rec.gain}</span>
        ) : null}

        {ads.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {ads.slice(0, 6).map(({ ad }) => (
              <button
                key={ad.id}
                type="button"
                onClick={() => onOpenAd(ad.id)}
                title={ad.name}
                className="group flex max-w-[180px] items-center gap-1.5 rounded-full border border-zinc-200 bg-white py-0.5 pr-2.5 pl-0.5 text-xs text-zinc-700 transition-colors hover:border-black hover:text-black"
              >
                <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-zinc-100">
                  {ad.media[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ad.media[0].image} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
                  ) : null}
                </span>
                <span className="truncate">{ad.name}</span>
              </button>
            ))}
            {ads.length > 6 ? <span className="text-xs text-zinc-400">+{ads.length - 6} more</span> : null}
          </div>
        ) : null}

        {open && rec.steps.length > 0 ? (
          <ol className="space-y-1.5 rounded-lg bg-zinc-50 p-3">
            {rec.steps.map((step, i) => (
              <li key={step} className="flex gap-2 text-sm text-zinc-700">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-zinc-500 ring-1 ring-zinc-200">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          {rec.steps.length > 0 ? (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-black"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
              {open ? "Hide steps" : "How to do it"}
            </button>
          ) : null}
          {ads.length === 1 && !demo ? (
            <a
              href={adsManagerUrl(accountId, ads[0].ad.id)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-black"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ads Manager
            </a>
          ) : null}
          <span className="flex-1" />
          <button
            type="button"
            onClick={onDone}
            className="inline-flex items-center gap-1 rounded border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-700 transition-colors hover:border-black hover:bg-black hover:text-white"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Done
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            title="Not relevant — hide for 2 weeks"
            className="inline-flex items-center rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-black"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

function BudgetSplit({ rows, money }: { rows: JudgedAd[]; money: (value: number) => string }) {
  const total = rows.reduce((sum, row) => sum + row.ad.spend, 0);
  const split = VERDICT_ORDER.map((verdict) => {
    const spend = rows.filter((row) => row.j.verdict === verdict).reduce((sum, row) => sum + row.ad.spend, 0);
    return { verdict, spend, share: total > 0 ? spend / total : 0 };
  });
  const good = split.filter((s) => s.verdict === "winner" || s.verdict === "promising").reduce((sum, s) => sum + s.share, 0);
  const bad = split.find((s) => s.verdict === "loser")?.share ?? 0;
  const testing = split.find((s) => s.verdict === "testing")?.share ?? 0;
  const message =
    total === 0
      ? "No spend in this period yet."
      : bad >= 0.3
        ? "Too much budget is going to creatives that don't work. Start with the Cut actions."
        : good >= 0.6
          ? "Most of your budget backs creatives that work. Keep scaling and feeding new tests."
          : "A lot of budget is still in testing. Normal early on, but keep tests on a short leash.";
  const score = Math.round(Math.max(0, Math.min(100, good * 100 + testing * 40 - bad * 30)));
  const tone = score >= 65 ? "text-emerald-600" : score >= 40 ? "text-amber-500" : "text-red-600";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Where your budget went</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold text-black">{Math.round(good * 100)}%</p>
          <p className="text-xs text-zinc-500">on winning &amp; promising creatives</p>
        </div>
        <ScoreRing score={score} tone={tone} />
      </div>

      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-zinc-100">
        {split.map((s) =>
          s.share > 0 ? (
            <div key={s.verdict} className={SPLIT[s.verdict].bar} style={{ width: `${s.share * 100}%` }} title={`${SPLIT[s.verdict].label}: ${money(s.spend)}`} />
          ) : null,
        )}
      </div>

      <ul className="mt-3 space-y-1.5">
        {split.map((s) => (
          <li key={s.verdict} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 text-zinc-600">
              <span className={`h-2 w-2 rounded-full ${SPLIT[s.verdict].bar}`} />
              {SPLIT[s.verdict].label}
            </span>
            <span className="tabular-nums text-zinc-500">
              <b className="text-black">{money(s.spend)}</b> · {Math.round(s.share * 100)}%
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-600">{message}</p>
    </div>
  );
}

function ScoreRing({ score, tone }: { score: number; tone: string }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative h-14 w-14" title="Budget health score">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="currentColor" strokeWidth="5" className="text-zinc-100" />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          className={`${tone} transition-[stroke-dashoffset] duration-500`}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold leading-none text-black">{score}</span>
        <span className="text-[8px] font-semibold uppercase tracking-wider text-zinc-400">Health</span>
      </span>
    </div>
  );
}
