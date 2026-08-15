"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type GateStatus = {
  blocking: boolean;
  heroImageUrl: string;
  endAt: string;
  requirePassword: boolean;
  hasPassword: boolean;
};

/** Paths that must stay reachable while the site gate is on. */
function isExemptPath(path: string | null): boolean {
  if (!path) return true;
  return /^\/(dashboard|admin|api|backoffice|login)(\/|$)/i.test(path);
}

function formatRemaining(ms: number): { d: number; h: number; m: number; s: number } {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

function Segment({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="tabular-nums text-3xl sm:text-5xl font-black tracking-tight">
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-1 text-[9px] sm:text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60">
        {label}
      </span>
    </div>
  );
}

export function ComingSoonGate() {
  const pathname = usePathname();
  const [status, setStatus] = useState<GateStatus | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exempt = isExemptPath(pathname);

  const loadStatus = useCallback(async () => {
    if (exempt) {
      setStatus(null);
      return;
    }
    try {
      const res = await fetch("/api/coming-soon/status", { cache: "no-store" });
      if (!res.ok) {
        setStatus(null);
        return;
      }
      const data = (await res.json().catch(() => null)) as GateStatus | null;
      setStatus(data);
    } catch {
      setStatus(null);
    }
  }, [exempt]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus, pathname]);

  const blocking = Boolean(status?.blocking) && !exempt;

  useEffect(() => {
    if (!blocking) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [blocking]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = blocking ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [blocking]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/coming-soon/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, next: pathname || "/" }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Invalid password");
      }
      setPassword("");
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid password");
    } finally {
      setSubmitting(false);
    }
  };

  if (!blocking || !status) return null;

  const endMs = status.endAt ? Date.parse(status.endAt) : NaN;
  const showCountdown = !Number.isNaN(endMs) && endMs > now;
  const remaining = showCountdown ? formatRemaining(endMs - now) : null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-black text-white">
      {status.heroImageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={status.heroImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" aria-hidden />
        </>
      ) : null}

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center px-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-white/70">Classy V</p>
        <h1 className="mt-4 text-4xl font-black uppercase leading-none tracking-tight sm:text-6xl">
          Coming soon
        </h1>
        <p className="mt-4 max-w-sm text-sm text-white/70">
          Something new is on the way. Stay tuned.
        </p>

        {remaining ? (
          <div className="mt-8 flex items-start justify-center gap-4 sm:gap-6">
            <Segment value={remaining.d} label="Days" />
            <span className="text-3xl sm:text-5xl font-black text-white/40">:</span>
            <Segment value={remaining.h} label="Hours" />
            <span className="text-3xl sm:text-5xl font-black text-white/40">:</span>
            <Segment value={remaining.m} label="Min" />
            <span className="text-3xl sm:text-5xl font-black text-white/40">:</span>
            <Segment value={remaining.s} label="Sec" />
          </div>
        ) : null}

        {status.requirePassword && status.hasPassword ? (
          <form onSubmit={handleUnlock} className="mt-10 w-full max-w-xs">
            <label className="block text-left text-[10px] font-semibold uppercase tracking-[0.28em] text-white/60">
              Enter access password
            </label>
            <div className="mt-2 flex gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="off"
                className="flex-1 rounded-md border border-white/25 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={submitting || !password}
                className="rounded-md bg-white px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-white/90 disabled:opacity-50"
              >
                {submitting ? "…" : "Enter"}
              </button>
            </div>
            {error ? <p className="mt-2 text-left text-xs text-red-300">{error}</p> : null}
          </form>
        ) : null}
      </div>
    </div>
  );
}
