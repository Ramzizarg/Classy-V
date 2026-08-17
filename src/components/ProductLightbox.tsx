"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronGlyph, CloseGlyph } from "@/components/SocialGlyphs";

const MAX_SCALE = 4;
/** Where a double tap lands, and the step the desktop buttons move in. */
const TAP_SCALE = 2.5;
const SWIPE_DISTANCE = 56;
const DISMISS_DISTANCE = 120;
const DOUBLE_TAP_MS = 300;

type View = { scale: number; x: number; y: number };
const RESET: View = { scale: 1, x: 0, y: 0 };

type Props = {
  images: string[];
  name: string;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

export function ProductLightbox({ images, name, index, onIndexChange, onClose }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(RESET);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  /** Live finger offsets: horizontal pages between views, vertical dismisses. */
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({
    mode: "idle" as "idle" | "pan" | "pinch" | "swipe" | "dismiss",
    startX: 0,
    startY: 0,
    startView: RESET,
    startDistance: 0,
    focalX: 0,
    focalY: 0,
    moved: false,
    lastTapAt: 0,
  });

  const zoomed = view.scale > 1.01;

  /**
   * How far the image may travel at a given scale. Measured from the letterboxed
   * box rather than the stage, so a portrait shot cannot be dragged into the bars
   * either side of it.
   */
  const limits = useCallback(
    (scale: number) => {
      const stage = stageRef.current;
      if (!stage || !natural) return { x: 0, y: 0 };

      const stageWidth = stage.clientWidth;
      const stageHeight = stage.clientHeight;
      const ratio = natural.w / natural.h;

      let width = stageWidth;
      let height = stageWidth / ratio;
      if (height > stageHeight) {
        height = stageHeight;
        width = stageHeight * ratio;
      }

      return {
        x: Math.max(0, (width * scale - stageWidth) / 2),
        y: Math.max(0, (height * scale - stageHeight) / 2),
      };
    },
    [natural]
  );

  const clamp = useCallback(
    (next: View): View => {
      const scale = Math.min(MAX_SCALE, Math.max(1, next.scale));
      const bound = limits(scale);
      return {
        scale,
        x: Math.min(bound.x, Math.max(-bound.x, next.x)),
        y: Math.min(bound.y, Math.max(-bound.y, next.y)),
      };
    },
    [limits]
  );

  /** Scales about a focal point held in stage-centre coordinates, so it stays put. */
  const zoomAround = useCallback(
    (scale: number, focalX: number, focalY: number, from: View) => {
      const next = Math.min(MAX_SCALE, Math.max(1, scale));
      const factor = next / from.scale;
      setView(
        clamp({
          scale: next,
          x: focalX - (focalX - from.x) * factor,
          y: focalY - (focalY - from.y) * factor,
        })
      );
    },
    [clamp]
  );

  const reset = useCallback(() => setView(RESET), []);

  const goTo = useCallback(
    (next: number) => {
      const wrapped = (next + images.length) % images.length;
      onIndexChange(wrapped);
      setNatural(null);
      reset();
    },
    [images.length, onIndexChange, reset]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") goTo(index + 1);
      if (event.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [goTo, index, onClose]);

  /** Registered by hand: React's wheel listener is passive, so it cannot block the page zoom. */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      const focalX = event.clientX - rect.left - rect.width / 2;
      const focalY = event.clientY - rect.top - rect.height / 2;
      setView((current) => {
        const next = Math.min(
          MAX_SCALE,
          Math.max(1, current.scale * (event.deltaY < 0 ? 1.16 : 1 / 1.16))
        );
        const factor = next / current.scale;
        const bound = limits(next);
        const x = focalX - (focalX - current.x) * factor;
        const y = focalY - (focalY - current.y) * factor;
        return {
          scale: next,
          x: Math.min(bound.x, Math.max(-bound.x, x)),
          y: Math.min(bound.y, Math.max(-bound.y, y)),
        };
      });
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [limits]);

  const stagePoint = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  };

  const beginSingle = (clientX: number, clientY: number) => {
    const state = gesture.current;
    state.mode = view.scale > 1.01 ? "pan" : "idle";
    state.startX = clientX;
    state.startY = clientY;
    state.startView = view;
    state.moved = false;
  };

  const onPointerDown = (event: React.PointerEvent) => {
    stageRef.current?.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setDragging(true);

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const state = gesture.current;
      state.mode = "pinch";
      state.startDistance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      state.startView = view;
      const focal = stagePoint((a.x + b.x) / 2, (a.y + b.y) / 2);
      state.focalX = focal.x;
      state.focalY = focal.y;
      setDragX(0);
      setDragY(0);
    } else if (pointers.current.size === 1) {
      beginSingle(event.clientX, event.clientY);
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const state = gesture.current;

    if (state.mode === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      zoomAround(
        state.startView.scale * (distance / state.startDistance),
        state.focalX,
        state.focalY,
        state.startView
      );
      return;
    }

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) state.moved = true;

    if (state.mode === "idle") {
      /** First meaningful move picks the axis: sideways pages, downward dismisses. */
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        state.mode = Math.abs(dx) > Math.abs(dy) ? "swipe" : "dismiss";
      }
    }

    if (state.mode === "pan") {
      setView(clamp({ scale: state.startView.scale, x: state.startView.x + dx, y: state.startView.y + dy }));
    } else if (state.mode === "swipe") {
      setDragX(dx);
    } else if (state.mode === "dismiss") {
      setDragY(Math.max(0, dy));
    }
  };

  const endGesture = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    const state = gesture.current;

    if (state.mode === "pinch") {
      /** Lifting one finger of a pinch hands over to a pan rather than ending the gesture. */
      const remaining = [...pointers.current.values()][0];
      if (remaining) {
        beginSingle(remaining.x, remaining.y);
        gesture.current.mode = "pan";
        gesture.current.startView = view;
        return;
      }
      if (view.scale <= 1.01) reset();
      state.mode = "idle";
      setDragging(false);
      return;
    }

    if (state.mode === "swipe") {
      if (Math.abs(dragX) > SWIPE_DISTANCE) goTo(index + (dragX < 0 ? 1 : -1));
      setDragX(0);
    } else if (state.mode === "dismiss") {
      if (dragY > DISMISS_DISTANCE) {
        onClose();
        return;
      }
      setDragY(0);
    } else if (!state.moved) {
      const now = Date.now();
      if (now - state.lastTapAt < DOUBLE_TAP_MS) {
        const focal = stagePoint(event.clientX, event.clientY);
        if (view.scale > 1.01) reset();
        else zoomAround(TAP_SCALE, focal.x, focal.y, view);
        state.lastTapAt = 0;
      } else {
        state.lastTapAt = now;
      }
    }

    if (pointers.current.size === 0) {
      state.mode = "idle";
      setDragging(false);
    }
  };

  if (typeof document === "undefined") return null;

  const progress = Math.min(1, dragY / (DISMISS_DISTANCE * 2));

  return createPortal(
    <div
      className="fixed inset-0 z-[240] flex flex-col"
      role="dialog"
      aria-modal
      aria-label={`${name} images`}
      style={{ background: `rgb(0 0 0 / ${0.94 - progress * 0.5})` }}
    >
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 text-white">
        <span className="ui tabular-nums">
          {index + 1} / {images.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close gallery"
          className="-m-2 p-2 hover:opacity-70"
        >
          <CloseGlyph className="h-5 w-5" />
        </button>
      </div>

      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        className="relative flex-1 touch-none overflow-hidden"
        style={{ transform: `translate3d(0, ${dragY}px, 0)`, cursor: zoomed ? "grab" : "zoom-in" }}
      >
        <div
          className="lb-track flex h-full w-full"
          data-dragging={dragging}
          style={{ transform: `translate3d(calc(${-index * 100}% + ${dragX}px), 0, 0)` }}
        >
          {images.map((image, slide) => (
            <div key={image} className="relative h-full w-full shrink-0 grow-0 basis-full">
              <div
                className="lb-frame absolute inset-0"
                data-dragging={dragging}
                style={
                  slide === index
                    ? { transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }
                    : undefined
                }
              >
                <Image
                  src={image}
                  alt={`${name} — view ${slide + 1}`}
                  fill
                  /** Asks for a source large enough to hold up when pinched in. */
                  sizes="(min-width: 1024px) 90vw, 180vw"
                  priority={slide === index}
                  draggable={false}
                  onLoad={(event) => {
                    if (slide !== index) return;
                    const img = event.currentTarget;
                    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
                  }}
                  className="h-full w-full object-contain p-4 select-none sm:p-10"
                />
              </div>
            </div>
          ))}
        </div>

        {images.length > 1 && !zoomed ? (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Previous view"
              className="absolute top-1/2 left-1 hidden -translate-y-1/2 p-3 text-white/70 hover:text-white sm:block"
            >
              <ChevronGlyph className="h-6 w-6 rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Next view"
              className="absolute top-1/2 right-1 hidden -translate-y-1/2 p-3 text-white/70 hover:text-white sm:block"
            >
              <ChevronGlyph className="h-6 w-6" />
            </button>
          </>
        ) : null}

        {!zoomed ? (
          <p className="lb-hint ui-sm pointer-events-none absolute inset-x-0 bottom-3 text-center text-white/70">
            Double tap or pinch to zoom
          </p>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="relative z-10 flex justify-center gap-2 px-4 py-4">
          {images.map((image, slide) => (
            <button
              key={image}
              type="button"
              onClick={() => goTo(slide)}
              aria-label={`Show view ${slide + 1}`}
              aria-current={slide === index}
              className={`h-1.5 rounded-full transition-all ${
                slide === index ? "w-6 bg-white" : "w-1.5 bg-white/40"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>,
    document.body
  );
}
