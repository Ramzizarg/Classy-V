"use client";

import { useStore } from "@/components/StoreProvider";

export function Toaster() {
  const { toast, cartOpen } = useStore();
  /** The toast outranks the drawer, so it would otherwise cover the cart's own buttons. */
  if (!toast || cartOpen) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <p className="camo-surface ui border border-foreground px-3 py-2">{toast}</p>
    </div>
  );
}
