"use client";

import { useStore } from "@/components/StoreProvider";

export function Toaster() {
  const { toast } = useStore();
  if (!toast) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <p className="camo-surface ui border border-foreground px-3 py-2">{toast}</p>
    </div>
  );
}
