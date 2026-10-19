"use client";

import { useEffect, useRef, useState } from "react";

/** Soft pulse on the product image when less than this remains. */
export const DROP_URGENCY_MS = 60 * 60 * 1000; // 1 hour

function partsFromMs(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

type Variant = "card" | "overlay" | "panel";

type Segment = { value: string; label: string };

function buildSegments(
  ms: number,
  compact: boolean
): { segments: Segment[]; d: number; h: number; m: number; s: number } {
  const { d, h, m, s } = partsFromMs(ms);
  if (compact) {
    const segments: Segment[] =
      d > 0
        ? [
            { value: pad(Math.min(d, 99)), label: "D" },
            { value: pad(h), label: "H" },
            { value: pad(m), label: "M" },
            { value: pad(s), label: "S" },
          ]
        : [
            { value: pad(h), label: "H" },
            { value: pad(m), label: "M" },
            { value: pad(s), label: "S" },
          ];
    return { segments, d, h, m, s };
  }

  const segments: Segment[] =
    d > 0
      ? [
          { value: String(d), label: d === 1 ? "Day" : "Days" },
          { value: pad(h), label: "Hrs" },
          { value: pad(m), label: "Min" },
          { value: pad(s), label: "Sec" },
        ]
      : [
          { value: pad(h), label: "Hrs" },
          { value: pad(m), label: "Min" },
          { value: pad(s), label: "Sec" },
        ];
  return { segments, d, h, m, s };
}

/**
 * Live drop countdown for coming-soon products.
 * Ticks only while on-screen so grid cards don’t burn timers off-viewport.
 */
export function ProductCountdown({
  endsAt,
  variant = "card",
  onComplete,
  onUrgentChange,
}: {
  endsAt?: string | null;
  variant?: Variant;
  onComplete?: () => void;
  onUrgentChange?: (urgent: boolean) => void;
}) {
  const target = endsAt ? Date.parse(endsAt) : NaN;
  const hasTarget = Number.isFinite(target);
  const [now, setNow] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const compact = variant === "overlay" || variant === "card";

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setVisible(entry.isIntersecting);
      },
      { root: null, rootMargin: "80px 0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!hasTarget) {
      onUrgentChange?.(false);
      return;
    }
    if (!visible) return;

    const tick = () => {
      const t = Date.now();
      setNow(t);
      const remaining = target - t;
      onUrgentChange?.(remaining > 0 && remaining <= DROP_URGENCY_MS);
      if (t >= target) onComplete?.();
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [hasTarget, target, visible, onComplete, onUrgentChange]);

  if (!hasTarget) {
    return (
      <div
        ref={rootRef}
        className={`product-countdown product-countdown--${variant} product-countdown--static`}
      >
        Coming soon
      </div>
    );
  }

  if (now == null) {
    return (
      <div
        ref={rootRef}
        className={`product-countdown product-countdown--${variant} product-countdown--static`}
      >
        Coming soon
      </div>
    );
  }

  if (now >= target) {
    return (
      <div
        ref={rootRef}
        className={`product-countdown product-countdown--${variant} product-countdown--static`}
      >
        Available now
      </div>
    );
  }

  const { segments, d, h, m, s } = buildSegments(target - now, compact);

  return (
    <div
      ref={rootRef}
      className={`product-countdown product-countdown--${variant}`}
      role="timer"
      aria-live="polite"
      aria-label={`Drops in ${d > 0 ? `${d} days, ` : ""}${h} hours, ${m} minutes, ${s} seconds`}
    >
      {segments.map((segment, index) => (
        <div key={`${segment.label}-${index}`} className="product-countdown__block">
          {index > 0 ? (
            <span className="product-countdown__sep" aria-hidden>
              :
            </span>
          ) : null}
          <span className="product-countdown__cell">
            <span className="product-countdown__value">{segment.value}</span>
            <span className="product-countdown__unit">{segment.label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
