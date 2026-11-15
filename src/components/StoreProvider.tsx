"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { cartCount, cartSubtotal } from "@/lib/cart";
import { applyJoggerDuoPricing } from "@/lib/joggerDuo";
import * as shopStore from "@/lib/clientStore";
import { metaCatalogContentId, trackMeta } from "@/lib/metaPixel";
import type { CartLine, Product } from "@/lib/types";

type StoreContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  shippingRate: number;
  setShippingRate: (rate: number) => void;
  hydrated: boolean;
  cartOpen: boolean;
  toast: string | null;
  wishlist: number[];
  /** `false` when stock left nothing to add. */
  addLine: (line: CartLine, options?: { openCart?: boolean }) => boolean;
  /** Most units of a line the bag may hold. */
  lineLimit: (line: Pick<CartLine, "productId" | "size">) => number;
  setQuantity: (line: Pick<CartLine, "productId" | "size">, quantity: number) => void;
  removeLine: (line: Pick<CartLine, "productId" | "size">) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleWishlist: (productId: number) => void;
  showToast: (message: string) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({
  children,
  shippingRate,
}: {
  children: React.ReactNode;
  shippingRate: number;
}) {
  const { lines: storedLines, wishlist, hydrated, catalog } = useSyncExternalStore(
    shopStore.subscribe,
    shopStore.getSnapshot,
    shopStore.getServerSnapshot
  );
  /** Same pair-deal pass the order API runs, so the bag total matches what is charged. */
  const lines = useMemo(() => {
    if (!catalog) return storedLines;
    const joggers = new Set(catalog.joggers);
    return applyJoggerDuoPricing(storedLines, storedLines.map((line) => joggers.has(line.productId)));
  }, [storedLines, catalog]);

  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [currentShippingRate, setCurrentShippingRate] = useState(shippingRate);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.body.style.overflow = cartOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [cartOpen]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  /**
   * Re-check the bag against live stock and prices on load and whenever the shopper
   * returns to the tab (in-app browsers often resume a page hours later).
   */
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    let lastRun = 0;
    const refresh = () => {
      if (Date.now() - lastRun < 60_000) return;
      lastRun = Date.now();
      fetch("/api/catalog")
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data: { products?: Product[] }) => {
          if (cancelled || !Array.isArray(data.products)) return;
          const affected = shopStore.refreshLinesFromCatalog(data.products);
          if (affected.length > 0) {
            showToast(`Bag updated — ${affected[0]}${affected.length > 1 ? " and more" : ""} changed availability`);
          }
        })
        .catch(() => {
          lastRun = 0;
        });
    };
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", refresh);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", refresh);
    };
  }, [hydrated, showToast]);

  const addLine = useCallback<StoreContextValue["addLine"]>(
    (line, options) => {
      const before = shopStore
        .getSnapshot()
        .lines.find((entry) => entry.productId === line.productId && entry.size === line.size)?.quantity ?? 0;
      const { quantity, capped } = shopStore.addLine(line);
      const added = quantity - before;
      if (added <= 0) {
        showToast(`No more ${line.size} in stock`);
        return false;
      }
      if (capped) showToast(`Only ${quantity} available in ${line.size}`);
      const contentId = metaCatalogContentId(line);
      if (contentId) {
        trackMeta("AddToCart", {
          content_ids: [contentId],
          content_name: line.name,
          content_type: "product",
          contents: [{ id: contentId, quantity: added, item_price: line.unitPrice }],
          value: line.unitPrice * added,
          num_items: added,
        });
      }
      if (options?.openCart !== false) setCartOpen(true);
      return true;
    },
    [showToast]
  );

  const toggleWishlist = useCallback(
    (productId: number) => {
      const saved = shopStore.toggleWishlist(productId);
      showToast(saved ? "Saved to wishlist" : "Removed from wishlist");
    },
    [showToast]
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      lines,
      count: cartCount(lines),
      subtotal: cartSubtotal(lines),
      shippingRate: currentShippingRate,
      setShippingRate: setCurrentShippingRate,
      hydrated,
      cartOpen,
      toast,
      wishlist,
      addLine,
      lineLimit: (line) => shopStore.lineLimit(line, catalog),
      setQuantity: shopStore.setQuantity,
      removeLine: shopStore.removeLine,
      clearCart: shopStore.clearCart,
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
      toggleWishlist,
      showToast,
    }),
    [
      lines,
      catalog,
      wishlist,
      hydrated,
      cartOpen,
      toast,
      currentShippingRate,
      addLine,
      toggleWishlist,
      showToast,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside <StoreProvider>");
  return context;
}
