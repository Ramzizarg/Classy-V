"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseGlyph } from "@/components/SocialGlyphs";
import { formatPrice } from "@/lib/format";

type Props = {
  reference: string;
  firstName: string;
  total: number;
  /** Runs on the close button, the backdrop and Escape — all three send the shopper home. */
  onClose: () => void;
};

export function OrderPlacedModal({ reference, firstName, total, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[240] flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="order-placed-title"
    >
      <button
        type="button"
        aria-label="Close and continue shopping"
        onClick={onClose}
        className="fade-in absolute inset-0 bg-black/85"
      />

      <div className="order-panel camo-surface relative w-full max-w-md border border-line sm:rounded-2xl">
        <button
          ref={closeButton}
          type="button"
          onClick={onClose}
          aria-label="Close and continue shopping"
          className="absolute top-3 right-3 p-1 text-muted hover:text-foreground"
        >
          <CloseGlyph className="h-4 w-4" />
        </button>

        <div className="px-5 pt-8 pb-5 text-center">
          <svg viewBox="0 0 52 52" aria-hidden className="mx-auto h-14 w-14">
            <circle className="order-check__ring" cx="26" cy="26" r="24" />
            <path className="order-check__tick" d="M15 27l7.5 7.5L37.5 19.5" />
          </svg>

          <h2 id="order-placed-title" className="product-title mt-4 font-bold">
            Order placed
          </h2>
          <p className="ui-sm mt-2 text-muted">
            {firstName ? `Thank you, ${firstName}.` : "Thank you."}
          </p>
        </div>

        <div className="mx-5 flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
          <span className="min-w-0">
            <span className="ui-sm block text-muted">Reference</span>
            <span className="ui mt-0.5 block font-bold tracking-[0.12em]">{reference}</span>
          </span>
          <button
            type="button"
            onClick={() => void copyReference()}
            className="ui-sm hover-underline shrink-0 text-muted"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <p className="ui-sm mx-5 mt-4 text-center leading-relaxed text-muted">
          We will call to confirm. Pay cash on delivery.
        </p>

        <div className="mx-5 mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="ui text-muted">Total to pay</span>
          <span className="checkout-amount tabular-nums">{formatPrice(total)}</span>
        </div>

        <div className="px-5 pt-5 pb-6">
          <Link href="/" onClick={onClose} className="btn btn--solid w-full">
            Continue shopping
          </Link>
          <Link
            href={`/track?ref=${encodeURIComponent(reference)}`}
            className="ui-sm hover-underline mt-3 block text-center text-muted"
          >
            Track this order
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}
