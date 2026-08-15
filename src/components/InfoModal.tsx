"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CloseGlyph } from "@/components/SocialGlyphs";

/**
 * Shared shell for the storefront's centred pop-ups: dark backdrop, title bar and a
 * body that scrolls on its own. Portalled to `body` so a trigger can sit inline in a
 * paragraph without nesting a panel inside it.
 */
export function InfoModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    /** Restored, not cleared: opening over the mobile menu must leave its own lock in place. */
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const close = `Close ${title.toLowerCase()}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-3"
      role="dialog"
      aria-modal
      aria-label={title}
    >
      <button
        type="button"
        aria-label={close}
        onClick={onClose}
        className="absolute inset-0 bg-black/80"
      />

      <div className="fade-in relative flex max-h-[86svh] w-full max-w-2xl flex-col border border-line bg-background">
        <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5">
          <span className="ui font-bold">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={close}
            className="-m-1 p-1 hover:opacity-70"
          >
            <CloseGlyph className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-3 pb-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
