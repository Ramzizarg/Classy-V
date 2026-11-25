"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import type { ProgressiveState } from "@/lib/progressivePricing";
import { toPublicProgressivePayload } from "@/lib/progressivePricing";

type PublicPayload = ReturnType<typeof toPublicProgressivePayload>;

const REFRESH_MS = 20_000;

function emptyPayload(fallbackPrice: number): PublicPayload {
  return {
    enabled: false,
    currentPrice: fallbackPrice,
    deliveredOrders: 0,
    remaining: 10,
    nextPrice: fallbackPrice + 5,
    progressPct: 0,
    progressInLevel: 0,
    milestoneInterval: 10,
    priceIncrement: 5,
    level: 0,
    currency: "DT",
  };
}

function formatIncrement(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function ProgressivePriceMeter({
  initial,
  fallbackPrice,
  onUpdate,
}: {
  initial?: PublicPayload | null;
  fallbackPrice: number;
  onUpdate?: (payload: PublicPayload) => void;
}) {
  const [data, setData] = useState<PublicPayload>(initial ?? emptyPayload(fallbackPrice));
  const [unlocked, setUnlocked] = useState(false);
  const levelRef = useRef(initial?.level ?? 0);
  const announcedRef = useRef(false);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (initial) {
      setData(initial);
      levelRef.current = initial.level;
      onUpdateRef.current?.(initial);
    }
  }, [initial]);

  useEffect(() => {
    let cancelled = false;

    const pull = async () => {
      try {
        const res = await fetch("/api/pricing/progressive", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as PublicPayload;
        if (cancelled || typeof payload.currentPrice !== "number") return;

        if (announcedRef.current && payload.level > levelRef.current) {
          setUnlocked(true);
          window.setTimeout(() => {
            if (!cancelled) setUnlocked(false);
          }, 4200);
        }
        announcedRef.current = true;
        levelRef.current = payload.level;
        setData(payload);
        onUpdateRef.current?.(payload);
      } catch {
        /* keep last good state */
      }
    };

    void pull();
    const id = window.setInterval(pull, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void pull();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!data.enabled) return null;

  const completed = data.progressInLevel;
  const interval = Math.max(1, data.milestoneInterval);
  const ticks = Array.from({ length: interval }, (_, index) => index < completed);
  const increment = data.priceIncrement ?? Math.max(0, data.nextPrice - data.currentPrice);

  return (
    <aside className="prog-meter" aria-live="polite">
      <div className="prog-meter__head">
        <p className="prog-meter__kicker">The price goes up</p>
        {unlocked ? (
          <p className="prog-meter__unlock" role="status">
            New price — {formatPrice(data.currentPrice)}
          </p>
        ) : (
          <p className="prog-meter__rule">
            +{formatIncrement(increment)} DT every {interval} delivered
          </p>
        )}
      </div>

      <div
        className="prog-meter__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={interval}
        aria-valuenow={completed}
        aria-label={`${completed} of ${interval} orders toward the next price`}
      >
        {ticks.map((filled, index) => (
          <span
            key={index}
            className={`prog-meter__tick${filled ? " prog-meter__tick--on" : ""}`}
            style={{ transitionDelay: `${Math.min(index, 9) * 28}ms` }}
          />
        ))}
      </div>

      <div className="prog-meter__meta">
        <span className="prog-meter__fraction tabular-nums">
          {completed}
          <span className="prog-meter__slash">/</span>
          {interval}
        </span>
        <span className="prog-meter__dot" aria-hidden />
        <span className="prog-meter__remain">
          {data.remaining === 1 ? "1 left" : `${data.remaining} left`}
        </span>
        <span className="prog-meter__dot" aria-hidden />
        <span className="prog-meter__next">
          Next <span className="tabular-nums">{formatPrice(data.nextPrice)}</span>
        </span>
      </div>
    </aside>
  );
}

/** Server → client initial payload helper. */
export function progressivePayloadFromState(state: ProgressiveState): PublicPayload {
  return toPublicProgressivePayload(state);
}
