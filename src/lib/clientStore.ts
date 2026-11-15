import {
  CART_STORAGE_KEY,
  MAX_LINE_QUANTITY,
  WISHLIST_STORAGE_KEY,
  cartLineKey,
  isCartLine,
} from "@/lib/cart";
import { isJogger } from "@/lib/facebookCatalog";
import { effectivePrice, isPurchasable, productHoverImage } from "@/lib/products";
import type { CartLine, Product } from "@/lib/types";

/** What the live catalog says about lines in the bag — never persisted, refreshed on load. */
export type CatalogFacts = {
  /** Units available per `cartLineKey`. */
  stock: Record<string, number>;
  /** Base (pre-pair-deal) price per product id. */
  price: Record<number, number>;
  joggers: number[];
};

/**
 * localStorage-backed cart/wishlist exposed as an external store so components can
 * read it with `useSyncExternalStore` (no state writes from effects, no SSR mismatch).
 */
export type ShopState = {
  hydrated: boolean;
  lines: CartLine[];
  wishlist: number[];
  catalog: CatalogFacts | null;
};

const SERVER_STATE: ShopState = { hydrated: false, lines: [], wishlist: [], catalog: null };

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
  state = { hydrated: true, lines: readLines(), wishlist: readWishlist(), catalog: null };
}

function emit(): void {
  for (const listener of listeners) listener();
}

function commit(next: Partial<Omit<ShopState, "hydrated">>, save = true): void {
  ensureInitialized();
  state = { ...state, ...next };
  if (save) persist();
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  /**
   * Hydrate from localStorage after the current render. Calling ensureInitialized
   * inside getSnapshot (or synchronously here) makes the first client snapshot
   * differ from getServerSnapshot and triggers a hydration mismatch on Cart.
   */
  if (typeof window !== "undefined" && !initialized) {
    queueMicrotask(() => {
      if (initialized) {
        emit();
        return;
      }
      ensureInitialized();
      emit();
    });
  }

  /** Keep tabs in sync when the cart changes elsewhere. */
  const onStorage = (event: StorageEvent) => {
    if (event.key !== CART_STORAGE_KEY && event.key !== WISHLIST_STORAGE_KEY) return;
    state = { ...state, hydrated: true, lines: readLines(), wishlist: readWishlist() };
    emit();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getSnapshot(): ShopState {
  return state;
}

export function getServerSnapshot(): ShopState {
  return SERVER_STATE;
}

/** Most units of this line the bag may hold (stock when known, else the API ceiling). */
export function lineLimit(line: Pick<CartLine, "productId" | "size">, catalog = state.catalog): number {
  const stock = catalog?.stock[cartLineKey(line)];
  return stock === undefined ? MAX_LINE_QUANTITY : Math.min(MAX_LINE_QUANTITY, stock);
}

/** Returns how many units the line now holds, so callers can tell when stock capped the add. */
export function addLine(line: CartLine): { quantity: number; capped: boolean } {
  ensureInitialized();
  const key = cartLineKey(line);
  const limit = lineLimit(line);
  const existing = state.lines.find((entry) => cartLineKey(entry) === key);
  const wanted = (existing?.quantity ?? 0) + line.quantity;
  const quantity = Math.max(0, Math.min(limit, wanted));
  // Pair deals are applied across the whole bag, so store the plain price.
  const basePrice = state.catalog?.price[line.productId];
  const stored = basePrice === undefined ? line : { ...line, unitPrice: basePrice };
  if (quantity > 0) {
    commit({
      lines: existing
        ? state.lines.map((entry) => (cartLineKey(entry) === key ? { ...entry, quantity } : entry))
        : [...state.lines, { ...stored, quantity }],
    });
  }
  return { quantity, capped: quantity < wanted };
}

export function setQuantity(target: Pick<CartLine, "productId" | "size">, quantity: number): void {
  const key = cartLineKey(target);
  const next = Math.min(lineLimit(target), Math.trunc(quantity));
  commit({
    lines:
      next <= 0
        ? state.lines.filter((entry) => cartLineKey(entry) !== key)
        : state.lines.map((entry) => (cartLineKey(entry) === key ? { ...entry, quantity: next } : entry)),
  });
}

export function removeLine(target: Pick<CartLine, "productId" | "size">): void {
  const key = cartLineKey(target);
  commit({ lines: state.lines.filter((entry) => cartLineKey(entry) !== key) });
}

export function clearCart(): void {
  commit({ lines: [] });
}

/**
 * Overlay the live catalog onto stored lines: names, images and prices follow the
 * shop, quantities shrink to stock, and lines that can no longer be bought drop out.
 * Returns the names of lines that were removed or reduced so the UI can say so.
 */
export function refreshLinesFromCatalog(products: Product[]): string[] {
  ensureInitialized();
  const byId = new Map(products.map((product) => [product.id, product]));
  const catalog: CatalogFacts = { stock: {}, price: {}, joggers: [] };
  for (const product of products) {
    catalog.price[product.id] = effectivePrice(product);
    if (isJogger(product)) catalog.joggers.push(product.id);
    for (const entry of product.sizes) {
      catalog.stock[cartLineKey({ productId: product.id, size: entry.size })] = entry.stock;
    }
  }

  const affected: string[] = [];
  let changed = false;
  const lines = state.lines.flatMap((line) => {
    const product = byId.get(line.productId);
    if (!product) return [line];
    const limit = lineLimit(line, catalog);
    if (!isPurchasable(product) || limit < 1) {
      changed = true;
      affected.push(line.name);
      return [];
    }
    const price = effectivePrice(product);
    const next: CartLine = {
      ...line,
      name: product.name,
      slug: product.slug,
      image: product.images[0] ?? line.image,
      hoverImage: productHoverImage(product.images),
      unitPrice: price,
      compareAtPrice: price < product.price ? product.price : null,
      quantity: Math.min(line.quantity, limit),
    };
    if (next.quantity < line.quantity) affected.push(line.name);
    const same = (Object.keys(next) as (keyof CartLine)[]).every((key) => next[key] === line[key]);
    if (same) return [line];
    changed = true;
    return [next];
  });
  if (changed) commit({ lines, catalog });
  else commit({ catalog }, false);
  return affected;
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
