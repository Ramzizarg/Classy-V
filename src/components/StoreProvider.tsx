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
import * as shopStore from "@/lib/clientStore";
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
  addLine: (line: CartLine, options?: { openCart?: boolean }) => void;
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
  const { lines, wishlist, hydrated } = useSyncExternalStore(
    shopStore.subscribe,
    shopStore.getSnapshot,
    shopStore.getServerSnapshot
  );

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

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    fetch("/api/catalog")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { products?: Product[] }) => {
        if (cancelled || !Array.isArray(data.products)) return;
        shopStore.refreshLinesFromCatalog(data.products);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hydrated, cartOpen]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const addLine = useCallback<StoreContextValue["addLine"]>((line, options) => {
    shopStore.addLine(line);
    if (options?.openCart !== false) setCartOpen(true);
  }, []);

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
