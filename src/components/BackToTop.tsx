"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const SHOW_AFTER_PX = 240;
const HIDE_UNDER_PX = 120;

const RING_SEGMENT = "TOP OF PAGE • ";
const RING_OFFSETS = ["0%", "33.333%", "66.666%"] as const;

function scrollTop() {
  return (
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  );
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function smoothScrollToTop(durationMs = 720) {
  const start = scrollTop();
  if (start <= 0) return;
  const t0 = performance.now();

  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / durationMs);
    const y = start * (1 - easeInOutCubic(t));
    window.scrollTo(0, y);
    if (t < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

/** Circular badge — spinning “TOP OF PAGE” ring + center ↑. */
export function BackToTop() {
  const pathname = usePathname();
  const pathId = useId().replace(/:/g, "");
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);

  const hide =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname === "/checkout";

  useEffect(() => {
    if (hide) {
      visibleRef.current = false;
      setVisible(false);
      return;
    }

    let frame = 0;

    const sync = () => {
      frame = 0;
      const y = scrollTop();
      const next = visibleRef.current ? y > HIDE_UNDER_PX : y > SHOW_AFTER_PX;
      if (next !== visibleRef.current) {
        visibleRef.current = next;
        setVisible(next);
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [hide, pathname]);

  if (hide) return null;

  const circlePathId = `btt-circle-${pathId}`;

  return (
    <button
      type="button"
      className="back-to-top"
      data-visible={visible ? "true" : "false"}
      aria-label="Back to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onClick={() => {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduceMotion) {
          window.scrollTo(0, 0);
          return;
        }
        smoothScrollToTop();
      }}
    >
      <span className="back-to-top__orbit" aria-hidden="true">
        <svg className="back-to-top__spin" viewBox="0 0 100 100">
          <defs>
            <path
              id={circlePathId}
              d="M 50,50 m -33.5,0 a 33.5,33.5 0 1,1 67,0 a 33.5,33.5 0 1,1 -67,0"
            />
          </defs>
          {RING_OFFSETS.map((offset) => (
            <text key={offset} className="back-to-top__text">
              <textPath href={`#${circlePathId}`} startOffset={offset}>
                {RING_SEGMENT}
              </textPath>
            </text>
          ))}
        </svg>
      </span>

      <span className="back-to-top__core" aria-hidden="true">
        <svg className="back-to-top__icon" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 18.5V7"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="square"
          />
          <path
            d="M6 12.25 12 6.25 18 12.25"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </svg>
      </span>
    </button>
  );
}
