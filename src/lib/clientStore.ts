import { CART_STORAGE_KEY, WISHLIST_STORAGE_KEY, cartLineKey, isCartLine } from "@/lib/cart";
import type { CartLine, Product } from "@/lib/types";

/**
 * localStorage-backed cart/wishlist exposed as an external store so components can
 * read it with `useSyncExternalStore` (no state writes from effects, no SSR mismatch).
 */
export type ShopState = {
  hydrated: boolean;
  lines: CartLine[];
  wishlist: number[];
};

const SERVER_STATE: ShopState = { hydrated: false, lines: [], wishlist: [] };

let state: ShopState = SERVER_STATE;
let initialized = false;
const listeners = new Set<() => void>();

function readLines(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCartLine) : [];
  } catch {
    return [];
  }
}

function readWishlist(): number[] {
  try {
    const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === "number") : [];
  } catch {
    return [];
  }
}

function persist(): void {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.lines));
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(state.wishlist));
  } catch {
    /* storage unavailable (private mode) — keep the in-memory cart */
  }
}

function ensureInitialized(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  state = { hydrated: true, lines: readLines(), wishlist: readWishlist() };
}

function emit(): void {
  for (const listener of listeners) listener();
}

function commit(next: Partial<Omit<ShopState, "hydrated">>): void {
  state = { ...state, ...next };
  persist();
  emit();
}

export function subscribe(listener: () => void): () => void {
  ensureInitialized();
  listeners.add(listener);

  /** Keep tabs in sync when the cart changes elsewhere. */
  const onStorage = (event: StorageEvent) => {
    if (event.key !== CART_STORAGE_KEY && event.key !== WISHLIST_STORAGE_KEY) return;
    state = { hydrated: true, lines: readLines(), wishlist: readWishlist() };
    emit();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getSnapshot(): ShopState {
  ensureInitialized();
  return state;
}

export function getServerSnapshot(): ShopState {
  return SERVER_STATE;
}

export function addLine(line: CartLine): void {
  const key = cartLineKey(line);
  const existing = state.lines.find((entry) => cartLineKey(entry) === key);
  commit({
    lines: existing
      ? state.lines.map((entry) =>
          cartLineKey(entry) === key ? { ...entry, quantity: entry.quantity + line.quantity } : entry
        )
      : [...state.lines, line],
  });
}

export function setQuantity(target: Pick<CartLine, "productId" | "size">, quantity: number): void {
  const key = cartLineKey(target);
  commit({
    lines:
      quantity <= 0
        ? state.lines.filter((entry) => cartLineKey(entry) !== key)
        : state.lines.map((entry) =>
            cartLineKey(entry) === key ? { ...entry, quantity } : entry
          ),
  });
}

export function removeLine(target: Pick<CartLine, "productId" | "size">): void {
  const key = cartLineKey(target);
  commit({ lines: state.lines.filter((entry) => cartLineKey(entry) !== key) });
}

export function clearCart(): void {
  commit({ lines: [] });
}

/** Overlay live product names (and slug/image) from Neon onto stored cart lines. */
export function refreshLinesFromCatalog(products: Product[]): void {
  const byId = new Map(products.map((product) => [product.id, product]));
  let changed = false;
  const lines = state.lines.map((line) => {
    const product = byId.get(line.productId);
    if (!product) return line;
    const image = product.images[0] ?? line.image;
    if (product.name === line.name && product.slug === line.slug && image === line.image) {
      return line;
    }
    changed = true;
    return { ...line, name: product.name, slug: product.slug, image };
  });
  if (changed) commit({ lines });
}

/** Returns `true` when the product ended up saved. */
export function toggleWishlist(productId: number): boolean {
  const saved = state.wishlist.includes(productId);
  commit({
    wishlist: saved
      ? state.wishlist.filter((id) => id !== productId)
      : [...state.wishlist, productId],
  });
  return !saved;
}
