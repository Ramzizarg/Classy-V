"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Save, Truck, X } from "lucide-react";
import { useStore } from "@/components/StoreProvider";

type Props = {
  open: boolean;
  onClose: () => void;
};

/** Popup used from the products page to change the flat delivery fee. */
export function DashboardDeliveryPriceModal({ open, onClose }: Props) {
  const { setShippingRate } = useStore();
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, saving]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setMessage("");
    setError("");
    setLoading(true);
    (async () => {
      try {
        const response = await fetch("/api/shipping/settings");
        const payload = (await response.json()) as { deliveryPrice?: number };
        if (!cancelled) setPrice(String(payload.deliveryPrice ?? ""));
      } catch {
        if (!cancelled) setError("Could not load the current delivery price.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/shipping/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryPrice: Number(price) }),
      });
      const payload = (await response.json()) as { deliveryPrice?: number; error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not save the delivery price.");
        return;
      }
      const savedPrice = payload.deliveryPrice ?? Number(price);
      setPrice(String(savedPrice));
      setShippingRate(savedPrice);
      setMessage("Delivery price saved. Storefront totals now use this price.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={() => {
          if (!saving) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Delivery price"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-black p-2 text-white">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-black">Delivery price</h2>
              <p className="mt-1 text-xs text-zinc-500">
                This flat fee is added to every non-empty storefront and back-office order.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-black disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={save} className="px-5 py-4">
          <label className="block">
            <span className="text-xs font-medium text-zinc-800">Price (DT)</span>
            <div className="mt-2 flex items-center rounded-lg border border-zinc-300 bg-white focus-within:border-black">
              <input
                required
                autoFocus
                type="number"
                min="0"
                max="10000"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                disabled={loading}
                className="min-w-0 flex-1 rounded-l-lg px-3 py-2.5 text-sm text-black outline-none disabled:bg-zinc-50"
              />
              <span className="border-l border-zinc-200 px-3 py-2.5 text-sm font-medium text-zinc-500">
                DT
              </span>
            </div>
          </label>

          {message ? <p className="mt-3 text-sm font-medium text-emerald-700">{message}</p> : null}
          {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-zinc-50 disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving" : "Save delivery price"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
