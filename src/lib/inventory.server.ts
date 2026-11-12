import type { QueryResultRow } from "@neondatabase/serverless";
import { neonQuery, neonTransaction, type SqlStatement } from "@/lib/neon-db";
import {
  decrementSizeStock,
  incrementSizeStock,
  parseSizeStocks,
  serializeSizeStocks,
  totalSizeStock,
  type SizeStock,
} from "@/lib/productSizeStock";

export type StockLine = { productId: number; size: string; qty: number; name?: string };

export type StockCommit =
  | { ok: true; results: QueryResultRow[][] }
  | { ok: false; error: string; status: number };

type ProductStockRow = {
  id: number | string;
  name: string;
  stock: number | string | null;
  sizes: unknown;
  coming_soon: boolean | null;
  release_at: string | Date | null;
};

/** Postgres `division_by_zero`, raised on purpose by a stock guard that matched no row. */
const STOCK_CONFLICT = "22012";
const MAX_ATTEMPTS = 4;

function comingSoon(row: ProductStockRow): boolean {
  if (!row.coming_soon) return false;
  if (!row.release_at) return true;
  const at = new Date(row.release_at).getTime();
  return Number.isNaN(at) || at > Date.now();
}

/** Sums quantities per product + size so one guard covers every line of the same variant. */
function merge(lines: StockLine[]): StockLine[] {
  const byKey = new Map<string, StockLine>();
  for (const line of lines) {
    const qty = Math.floor(Number(line.qty) || 0);
    const size = line.size.trim();
    if (!Number.isFinite(line.productId) || line.productId < 1 || qty < 1 || !size) continue;
    const key = `${line.productId}::${size.toUpperCase()}`;
    const prev = byKey.get(key);
    if (prev) prev.qty += qty;
    else byKey.set(key, { productId: line.productId, size, qty, name: line.name });
  }
  return [...byKey.values()];
}

function isStockConflict(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return (e?.code ?? e?.cause?.code) === STOCK_CONFLICT;
}

/**
 * Applies stock changes and `statements` in a single transaction.
 *
 * Each product update only matches if its stock is still what was read, so two buyers
 * racing for the last unit cannot both win: the loser's transaction aborts, stock is
 * re-read, and the order is re-checked against what is actually left.
 */
export async function commitWithStock(opts: {
  take: StockLine[];
  restore?: StockLine[];
  rejectComingSoon?: boolean;
  statements: SqlStatement[];
}): Promise<StockCommit> {
  const take = merge(opts.take);
  const restore = merge(opts.restore ?? []);
  const productIds = [...new Set([...take, ...restore].map((line) => line.productId))];

  for (let attempt = 1; ; attempt++) {
    const byId = new Map<number, ProductStockRow>();
    if (productIds.length > 0) {
      const placeholders = productIds.map((_, i) => `$${i + 1}`).join(", ");
      const { rows } = await neonQuery<ProductStockRow>(
        `SELECT id, name, stock, sizes, coming_soon, release_at FROM products WHERE id IN (${placeholders})`,
        productIds,
      );
      for (const row of rows) byId.set(Number(row.id), row);
    }

    const next = new Map<number, { sizes: SizeStock[]; name: string }>();
    const stateFor = (productId: number, fallbackSize: string) => {
      const existing = next.get(productId);
      if (existing) return existing;
      const row = byId.get(productId);
      if (!row) return null;
      const parsed = parseSizeStocks(row.sizes, Number(row.stock) || 0);
      const sizes =
        parsed && parsed.length > 0
          ? parsed.map((s) => ({ ...s }))
          : [{ size: fallbackSize, stock: Math.max(0, Math.floor(Number(row.stock) || 0)) }];
      const state = { sizes, name: row.name };
      next.set(productId, state);
      return state;
    };

    for (const line of restore) {
      const state = stateFor(line.productId, line.size);
      if (!state) continue;
      state.sizes = incrementSizeStock(state.sizes, line.size, line.qty).sizes;
    }

    for (const line of take) {
      const row = byId.get(line.productId);
      if (!row) {
        return { ok: false, error: `Product not found: ${line.name || line.productId}.`, status: 400 };
      }
      if (opts.rejectComingSoon && comingSoon(row)) {
        return { ok: false, error: `"${row.name}" is coming soon and cannot be ordered yet.`, status: 409 };
      }
      const state = stateFor(line.productId, line.size)!;
      const dec = decrementSizeStock(state.sizes, line.size, line.qty);
      if (!dec) {
        return { ok: false, error: `Not enough stock for "${row.name}" (size ${line.size}).`, status: 409 };
      }
      state.sizes = dec.sizes;
    }

    const guards: SqlStatement[] = [...next].map(([productId, state]) => {
      const row = byId.get(productId)!;
      return {
        text: `WITH u AS (
                 UPDATE products SET sizes = $1::jsonb, stock = $2
                  WHERE id = $3
                    AND stock IS NOT DISTINCT FROM $4
                    AND sizes IS NOT DISTINCT FROM $5::jsonb
                 RETURNING 1
               )
               SELECT 1 / count(*) AS ok FROM u`,
        params: [
          JSON.stringify(serializeSizeStocks(state.sizes)),
          totalSizeStock(state.sizes),
          productId,
          row.stock == null ? null : Number(row.stock),
          row.sizes == null ? null : JSON.stringify(row.sizes),
        ],
      };
    });

    try {
      const results = await neonTransaction([...guards, ...opts.statements]);
      return { ok: true, results: results.slice(guards.length) };
    } catch (err) {
      if (!isStockConflict(err) || attempt >= MAX_ATTEMPTS) {
        if (isStockConflict(err)) {
          return { ok: false, error: "Stock changed while ordering. Please try again.", status: 409 };
        }
        throw err;
      }
    }
  }
}
