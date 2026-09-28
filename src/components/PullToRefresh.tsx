"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BRAND_LOGO_SRC } from "@/components/BrandMark";

const PULL_THRESHOLD = 96;
const MAX_PULL = 160;
const MIN_REVEAL = 96;
const AXIS_LOCK_PX = 12;
const MOBILE_MQ = "(max-width: 1023px)";

function scrollTop() {
  return (
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  );
}

function shouldEnable(pathname: string) {
  if (pathname.startsWith("/dashboard")) return false;
  if (pathname.startsWith("/admin")) return false;
  if (pathname.startsWith("/login")) return false;
  if (pathname.startsWith("/checkout")) return false;
  if (pathname.startsWith("/api")) return false;
  return true;
}

/**
 * Mobile pull-to-refresh: drag down from the top to reveal logo + spinner, then reload.
 */
export function PullToRefresh() {
  const pathname = usePathname();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<"none" | "x" | "y">("none");
  const pullRef = useRef(0);
  const pulling = useRef(false);
  const armed = useRef(false);
  const refreshingRef = useRef(false);

  const enabled = shouldEnable(pathname);

  useEffect(() => {
    if (!enabled) return;

    const isMobile = () => window.matchMedia(MOBILE_MQ).matches;

    const setPullBoth = (value: number) => {
      pullRef.current = value;
      setPull(value);
      const shift = value > 6 ? Math.max(value, MIN_REVEAL) : 0;
      document.documentElement.style.setProperty("--pull-refresh", `${shift}px`);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (!isMobile() || refreshingRef.current) return;
      if (event.touches.length !== 1) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('[aria-modal="true"], [role="dialog"], [data-no-pull-refresh]')
      ) {
        armed.current = false;
        return;
      }
      if (document.body.style.overflow === "hidden") {
        armed.current = false;
        return;
      }
      if (scrollTop() > 4) {
        armed.current = false;
        return;
      }
      const t = event.touches[0];
      if (!t) return;
      startX.current = t.clientX;
      startY.current = t.clientY;
      axis.current = "none";
      armed.current = true;
      pulling.current = false;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!armed.current || refreshingRef.current) return;
      if (scrollTop() > 4) {
        armed.current = false;
        document.documentElement.removeAttribute("data-pull-dragging");
        setPullBoth(0);
        return;
      }
      const t = event.touches[0];
      if (!t) return;
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;
      if (axis.current === "none") {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
        if (dy <= 0 || Math.abs(dy) < Math.abs(dx) * 1.5) {
          axis.current = "x";
          armed.current = false;
          return;
        }
        axis.current = "y";
        startY.current = t.clientY;
        return;
      }
      if (dy <= 6) {
        if (dy <= 0) {
          pulling.current = false;
          document.documentElement.removeAttribute("data-pull-dragging");
          setPullBoth(0);
        }
        return;
      }
      pulling.current = true;
      document.documentElement.setAttribute("data-pull-dragging", "1");
      const resisted = Math.min(MAX_PULL, (dy - 6) * 0.65);
      setPullBoth(resisted);
      if (resisted > 4 && event.cancelable) {
        event.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (!armed.current) return;
      armed.current = false;
      document.documentElement.removeAttribute("data-pull-dragging");
      const distance = pullRef.current;
      const shouldReload = pulling.current && distance >= PULL_THRESHOLD;
      pulling.current = false;

      if (shouldReload) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPullBoth(Math.max(distance, MIN_REVEAL));
        window.setTimeout(() => {
          window.location.reload();
        }, 480);
        return;
      }
      setPullBoth(0);
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
      document.documentElement.style.removeProperty("--pull-refresh");
      document.documentElement.removeAttribute("data-pull-dragging");
    };
  }, [enabled]);

  if (!enabled) return null;

  const progress = Math.min(1, pull / PULL_THRESHOLD);
  const active = pull > 6 || refreshing;
  const reveal = !active ? 0 : Math.max(pull, MIN_REVEAL);

  return (
    <div
      className={`pull-refresh${active ? " pull-refresh--active" : ""}${
        refreshing ? " pull-refresh--busy" : ""
      }`}
      style={{ height: reveal }}
      aria-hidden={!active}
    >
      <div className="pull-refresh__inner">
        <span
          className={`pull-refresh__spinner${
            refreshing || progress >= 0.9 ? " pull-refresh__spinner--spin" : ""
          }`}
          style={
            refreshing || progress >= 0.9
              ? undefined
              : { transform: `rotate(${progress * 300}deg)` }
          }
          aria-hidden
        >
          <svg viewBox="0 0 40 40" className="pull-refresh__spinner-svg">
            {Array.from({ length: 12 }, (_, i) => (
              <line
                key={i}
                className="pull-refresh__tick"
                x1="20"
                y1="5"
                x2="20"
                y2="11"
                transform={`rotate(${i * 30} 20 20)`}
                style={{ opacity: 0.15 + (i / 11) * 0.85 }}
              />
            ))}
          </svg>
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND_LOGO_SRC} alt="" className="pull-refresh__logo" draggable={false} />
      </div>
    </div>
  );
}
