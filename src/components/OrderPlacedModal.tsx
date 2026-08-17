"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseGlyph } from "@/components/SocialGlyphs";
import { formatPrice } from "@/lib/format";
import { SITE } from "@/lib/site";

type Props = {
  reference: string;
  firstName: string;
  total: number;
  /** Runs on the close button, the backdrop and Escape — all three send the shopper home. */
  onClose: () => void;
};

const STEPS = [
  {
    title: "Order received",
    copy: "Your details are with us. Nothing is charged yet.",
    state: "done" as const,
  },
  {
    title: "Confirmation call",
    copy: "We ring you to confirm the address and delivery day.",
    state: "current" as const,
  },
  {
    title: "Packed and delivered",
    copy: "Pay the courier in cash when your parcel arrives.",
    state: "todo" as const,
  },
];

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

  /** The confirmation call is the shopper's cue to quote this, so make it one tap to keep. */
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

      <div className="order-panel relative w-full max-w-md border border-line bg-background sm:rounded-2xl">
        <button
          ref={closeButton}
          type="button"
          onClick={onClose}
          aria-label="Close and continue shopping"
          className="absolute top-3 right-3 p-1 text-muted hover:text-foreground"
        >
          <CloseGlyph className="h-4 w-4" />
        </button>

        <div className="px-5 pt-8 pb-6 text-center">
          <svg viewBox="0 0 52 52" aria-hidden className="mx-auto h-14 w-14">
            <circle className="order-check__ring" cx="26" cy="26" r="24" />
            <path className="order-check__tick" d="M15 27l7.5 7.5L37.5 19.5" />
          </svg>

          <h2 id="order-placed-title" className="product-title mt-4 font-bold">
            Order placed
          </h2>
          <p className="ui-sm mt-2 text-muted">
            {firstName ? `Thank you, ${firstName}. ` : "Thank you. "}
            We are holding your pieces.
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

        <div className="px-5 pt-5">
          <ol>
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative flex gap-3 pb-4 last:pb-0">
                {index < STEPS.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute top-4 bottom-0 left-[6px] w-px bg-line"
                  />
                ) : null}

                <span
                  aria-hidden
                  className={`relative mt-1 h-3 w-3 shrink-0 rounded-full border ${
                    step.state === "done"
                      ? "border-foreground bg-foreground"
                      : step.state === "current"
                        ? "order-step-pulse border-foreground"
                        : "border-line"
                  }`}
                />

                <div className="min-w-0 flex-1 text-left">
                  <p className={`ui ${step.state === "todo" ? "text-muted" : ""}`}>
                    {step.title}
                    {step.state === "current" ? (
                      <span className="ui-sm ml-2 font-normal text-muted">— waiting</span>
                    ) : null}
                  </p>
                  <p className="ui-sm mt-1 leading-relaxed text-muted">{step.copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mx-5 mt-2 flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="ui text-muted">Total to pay on delivery</span>
          <span className="checkout-amount tabular-nums">{formatPrice(total)}</span>
        </div>

        <div className="mx-5 mt-4 rounded-xl border border-line px-4 py-3">
          <p className="ui-sm text-muted">Something to change? Reach us with your reference.</p>
          <div className="mt-2.5 flex gap-2">
            <a href={`tel:${SITE.phone.replace(/\s+/g, "")}`} className="btn flex-1 py-2">
              Call
            </a>
            <a
              href={`mailto:${SITE.email}?subject=${encodeURIComponent(`Order ${reference}`)}`}
              className="btn flex-1 py-2"
            >
              Email
            </a>
          </div>
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
