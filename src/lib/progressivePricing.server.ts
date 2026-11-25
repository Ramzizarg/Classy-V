import { cache } from "react";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import {
  DEFAULT_PROGRESSIVE_CONFIG,
  PROGRESSIVE_POOL_HOODIES,
  clampInterval,
  clampOffset,
  clampPrice,
  computeProgressiveState,
  toPublicProgressivePayload,
  type ProgressiveAdminMetrics,
  type ProgressiveAuditRow,
  type ProgressiveConfig,
  type ProgressiveLevelRow,
  type ProgressivePoolKey,
  type ProgressiveState,
} from "@/lib/progressivePricing";

export type { ProgressiveAdminMetrics, ProgressiveAuditRow, ProgressiveLevelRow };

type ConfigRow = {
  pool_key: string;
  enabled: boolean;
  base_price: string | number;
  milestone_interval: number;
  price_increment: string | number;
  manual_order_offset: number;
};

let tablesReady: Promise<void> | null = null;

function assertDb() {
  if (!resolveDatabaseUrl()) {
    throw new Error("DATABASE_URL is not set.");
  }
}

export function ensureProgressivePricingTables(): Promise<void> {
  tablesReady ??= (async () => {
    await neonQuery(`
      CREATE TABLE IF NOT EXISTS progressive_pricing (
        pool_key              TEXT PRIMARY KEY,
        enabled               BOOLEAN NOT NULL DEFAULT TRUE,
        base_price            NUMERIC(12, 2) NOT NULL DEFAULT 55,
        milestone_interval    INTEGER NOT NULL DEFAULT 10 CHECK (milestone_interval >= 1),
        price_increment       NUMERIC(12, 2) NOT NULL DEFAULT 5 CHECK (price_increment >= 0),
        manual_order_offset   INTEGER NOT NULL DEFAULT 0,
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await neonQuery(`
      INSERT INTO progressive_pricing (pool_key, enabled, base_price, milestone_interval, price_increment, manual_order_offset)
      VALUES ('hoodies', TRUE, 55, 10, 5, 0)
      ON CONFLICT (pool_key) DO NOTHING
    `);
    await neonQuery(`
      CREATE TABLE IF NOT EXISTS progressive_pricing_audit (
        id          SERIAL PRIMARY KEY,
        pool_key    TEXT NOT NULL DEFAULT 'hoodies',
        actor       TEXT,
        action      TEXT NOT NULL,
        before_json JSONB,
        after_json  JSONB,
        note        TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await neonQuery(`
      CREATE INDEX IF NOT EXISTS progressive_pricing_audit_created_idx
        ON progressive_pricing_audit (created_at DESC)
    `);
    await neonQuery(`
      CREATE TABLE IF NOT EXISTS progressive_pricing_levels (
        id                   SERIAL PRIMARY KEY,
        pool_key             TEXT NOT NULL DEFAULT 'hoodies',
        level                INTEGER NOT NULL,
        price                NUMERIC(12, 2) NOT NULL,
        delivered_orders_at  INTEGER NOT NULL,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (pool_key, level)
      )
    `);
    await neonQuery(`
      CREATE INDEX IF NOT EXISTS progressive_pricing_levels_pool_idx
        ON progressive_pricing_levels (pool_key, level)
    `);
  })().catch((error) => {
    tablesReady = null;
    throw error;
  });
  return tablesReady;
}

function rowToConfig(row: ConfigRow | undefined): ProgressiveConfig {
  if (!row) return { ...DEFAULT_PROGRESSIVE_CONFIG };
  return {
    poolKey: row.pool_key || PROGRESSIVE_POOL_HOODIES,
    enabled: Boolean(row.enabled),
    basePrice: clampPrice(row.base_price, DEFAULT_PROGRESSIVE_CONFIG.basePrice),
    milestoneInterval: clampInterval(row.milestone_interval),
    priceIncrement: clampPrice(row.price_increment, DEFAULT_PROGRESSIVE_CONFIG.priceIncrement),
    manualOrderOffset: clampOffset(row.manual_order_offset),
  };
}

/** Category slug/name normalized like the storefront hoodie rail. */
const HOODIE_CATEGORY_SQL = `
  LOWER(REPLACE(REPLACE(TRIM(COALESCE(c.slug, '')), ' ', '-'), '_', '-')) IN ('hoodies', 'hoodie')
  OR LOWER(REPLACE(REPLACE(TRIM(COALESCE(c.name, '')), ' ', '-'), '_', '-')) IN ('hoodies', 'hoodie')
`;

/**
 * Successfully delivered hoodie orders (distinct). Aligns with analytiques DELIVERED
 * plus admin-marked delivered without a return courier status.
 */
const QUALIFYING_ORDER_SQL = `
  SELECT COUNT(DISTINCT o.id)::int AS delivered
    FROM shop_orders o
   WHERE LOWER(COALESCE(o.status, '')) NOT IN ('rejected', 'cancelled')
     AND (
       (
         NULLIF(TRIM(COALESCE(o.xdelivery_barcode, '')), '') IS NOT NULL
         AND UPPER(COALESCE(o.xdelivery_status, '')) IN ('DELIVERED', 'DELIVERED_PAID')
       )
       OR (
         LOWER(COALESCE(o.status, '')) = 'delivered'
         AND (
           NULLIF(TRIM(COALESCE(o.xdelivery_barcode, '')), '') IS NULL
           OR (
             UPPER(COALESCE(o.xdelivery_status, '')) NOT LIKE 'RETURNED%'
             AND UPPER(COALESCE(o.xdelivery_status, '')) <> 'PENDING_RETURNS'
           )
         )
       )
     )
     AND EXISTS (
       SELECT 1
         FROM order_items i
         JOIN products p ON p.id = i.product_id
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE i.order_id = o.id
          AND (${HOODIE_CATEGORY_SQL})
     )
`;

export async function getProgressiveConfig(
  poolKey: ProgressivePoolKey = PROGRESSIVE_POOL_HOODIES,
): Promise<ProgressiveConfig> {
  if (!resolveDatabaseUrl()) return { ...DEFAULT_PROGRESSIVE_CONFIG, poolKey, enabled: false };
  await ensureProgressivePricingTables();
  const { rows } = await neonQuery<ConfigRow>(
    `SELECT pool_key, enabled, base_price, milestone_interval, price_increment, manual_order_offset
       FROM progressive_pricing
      WHERE pool_key = $1
      LIMIT 1`,
    [poolKey],
  );
  return rowToConfig(rows[0] ? { ...rows[0], pool_key: poolKey } : undefined);
}

export async function countQualifyingDeliveredOrders(): Promise<number> {
  if (!resolveDatabaseUrl()) return 0;
  await ensureProgressivePricingTables();
  try {
    const { rows } = await neonQuery<{ delivered: number }>(QUALIFYING_ORDER_SQL);
    return Math.max(0, Math.trunc(Number(rows[0]?.delivered ?? 0)));
  } catch (error) {
    console.error("[progressive-pricing] count failed:", error);
    return 0;
  }
}

/** Request-scoped cache so catalog + priceCart + PDP share one DB read. */
export const computeProgressiveStateFromDb = cache(
  async (poolKey: ProgressivePoolKey = PROGRESSIVE_POOL_HOODIES): Promise<ProgressiveState> => {
    const [config, delivered] = await Promise.all([
      getProgressiveConfig(poolKey),
      countQualifyingDeliveredOrders(),
    ]);
    return computeProgressiveState(delivered, config);
  },
);

export async function getPublicProgressivePricing(
  poolKey: ProgressivePoolKey = PROGRESSIVE_POOL_HOODIES,
) {
  const state = await computeProgressiveStateFromDb(poolKey);
  return toPublicProgressivePayload(state);
}

/** Effective storefront unit price for a hoodie when progressive pricing is enabled. */
export async function resolveHoodieUnitPrice(catalogPrice: number): Promise<number> {
  const state = await computeProgressiveStateFromDb();
  if (!state.enabled) return catalogPrice;
  return state.currentPrice;
}

async function writeAudit(input: {
  poolKey: ProgressivePoolKey;
  actor: string | null;
  action: string;
  before: unknown;
  after: unknown;
  note?: string | null;
}) {
  await neonQuery(
    `INSERT INTO progressive_pricing_audit (pool_key, actor, action, before_json, after_json, note)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
    [
      input.poolKey,
      input.actor,
      input.action,
      JSON.stringify(input.before ?? null),
      JSON.stringify(input.after ?? null),
      input.note ?? null,
    ],
  );
}

export async function recordLevelIfChanged(
  poolKey: ProgressivePoolKey = PROGRESSIVE_POOL_HOODIES,
): Promise<ProgressiveState> {
  const state = await computeProgressiveStateFromDb(poolKey);
  if (!resolveDatabaseUrl()) return state;

  await ensureProgressivePricingTables();
  const { rows } = await neonQuery<{ level: number; price: string | number }>(
    `SELECT level, price FROM progressive_pricing_levels
      WHERE pool_key = $1
      ORDER BY level DESC
      LIMIT 1`,
    [poolKey],
  );
  const last = rows[0];
  const lastLevel = last ? Math.trunc(Number(last.level)) : null;
  const lastPrice = last ? clampPrice(last.price, state.currentPrice) : null;

  if (lastLevel === state.level && lastPrice === state.currentPrice) {
    return state;
  }

  await neonQuery(
    `INSERT INTO progressive_pricing_levels (pool_key, level, price, delivered_orders_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (pool_key, level) DO UPDATE
       SET price = EXCLUDED.price,
           delivered_orders_at = EXCLUDED.delivered_orders_at,
           created_at = CASE
             WHEN progressive_pricing_levels.price IS DISTINCT FROM EXCLUDED.price
               OR progressive_pricing_levels.delivered_orders_at IS DISTINCT FROM EXCLUDED.delivered_orders_at
             THEN now()
             ELSE progressive_pricing_levels.created_at
           END`,
    [poolKey, state.level, state.currentPrice, state.effectiveDelivered],
  );

  if (lastLevel !== state.level || lastPrice !== state.currentPrice) {
    await writeAudit({
      poolKey,
      actor: "system",
      action: "level_change",
      before: last ? { level: lastLevel, price: lastPrice } : null,
      after: {
        level: state.level,
        price: state.currentPrice,
        deliveredOrders: state.deliveredOrders,
        effectiveDelivered: state.effectiveDelivered,
      },
      note: `NEW PRICE UNLOCKED — ${state.currentPrice} DT`,
    });
  }

  return state;
}

export type ProgressiveConfigPatch = {
  enabled?: boolean;
  basePrice?: number;
  milestoneInterval?: number;
  priceIncrement?: number;
  manualOrderOffset?: number;
  note?: string;
};

export async function updateProgressiveConfig(
  patch: ProgressiveConfigPatch,
  actor: string | null = "admin",
  poolKey: ProgressivePoolKey = PROGRESSIVE_POOL_HOODIES,
): Promise<ProgressiveState> {
  assertDb();
  await ensureProgressivePricingTables();
  const before = await computeProgressiveStateFromDb(poolKey);

  const next: ProgressiveConfig = {
    poolKey,
    enabled: patch.enabled ?? before.enabled,
    basePrice:
      patch.basePrice != null
        ? clampPrice(patch.basePrice, before.basePrice)
        : before.basePrice,
    milestoneInterval:
      patch.milestoneInterval != null
        ? clampInterval(patch.milestoneInterval)
        : before.milestoneInterval,
    priceIncrement:
      patch.priceIncrement != null
        ? clampPrice(patch.priceIncrement, before.priceIncrement)
        : before.priceIncrement,
    manualOrderOffset:
      patch.manualOrderOffset != null
        ? clampOffset(patch.manualOrderOffset)
        : before.manualOrderOffset,
  };

  await neonQuery(
    `INSERT INTO progressive_pricing (pool_key, enabled, base_price, milestone_interval, price_increment, manual_order_offset, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (pool_key) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       base_price = EXCLUDED.base_price,
       milestone_interval = EXCLUDED.milestone_interval,
       price_increment = EXCLUDED.price_increment,
       manual_order_offset = EXCLUDED.manual_order_offset,
       updated_at = now()`,
    [
      poolKey,
      next.enabled,
      next.basePrice,
      next.milestoneInterval,
      next.priceIncrement,
      next.manualOrderOffset,
    ],
  );

  await writeAudit({
    poolKey,
    actor,
    action: "config_update",
    before: {
      enabled: before.enabled,
      basePrice: before.basePrice,
      milestoneInterval: before.milestoneInterval,
      priceIncrement: before.priceIncrement,
      manualOrderOffset: before.manualOrderOffset,
    },
    after: {
      enabled: next.enabled,
      basePrice: next.basePrice,
      milestoneInterval: next.milestoneInterval,
      priceIncrement: next.priceIncrement,
      manualOrderOffset: next.manualOrderOffset,
    },
    note: patch.note ?? null,
  });

  return recordLevelIfChanged(poolKey);
}

export async function recalculateProgressivePricing(
  actor: string | null = "admin",
  poolKey: ProgressivePoolKey = PROGRESSIVE_POOL_HOODIES,
): Promise<ProgressiveState> {
  assertDb();
  await ensureProgressivePricingTables();
  const before = await computeProgressiveStateFromDb(poolKey);
  const after = await recordLevelIfChanged(poolKey);
  await writeAudit({
    poolKey,
    actor,
    action: "recalculate",
    before: {
      level: before.level,
      price: before.currentPrice,
      delivered: before.deliveredOrders,
    },
    after: {
      level: after.level,
      price: after.currentPrice,
      delivered: after.deliveredOrders,
    },
    note: "Safe recalculate — past order_items unchanged",
  });
  return after;
}

async function listLevels(poolKey: ProgressivePoolKey): Promise<ProgressiveLevelRow[]> {
  const { rows } = await neonQuery<{
    level: number;
    price: string | number;
    delivered_orders_at: number;
    created_at: string | Date;
  }>(
    `SELECT level, price, delivered_orders_at, created_at
       FROM progressive_pricing_levels
      WHERE pool_key = $1
      ORDER BY level ASC`,
    [poolKey],
  );
  return (rows ?? []).map((row) => ({
    level: Math.trunc(Number(row.level)),
    price: clampPrice(row.price, 0),
    deliveredOrdersAt: Math.trunc(Number(row.delivered_orders_at)),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));
}

async function listAudit(poolKey: ProgressivePoolKey, limit = 40): Promise<ProgressiveAuditRow[]> {
  const { rows } = await neonQuery<{
    id: number;
    actor: string | null;
    action: string;
    before_json: unknown;
    after_json: unknown;
    note: string | null;
    created_at: string | Date;
  }>(
    `SELECT id, actor, action, before_json, after_json, note, created_at
       FROM progressive_pricing_audit
      WHERE pool_key = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [poolKey, limit],
  );
  return (rows ?? []).map((row) => ({
    id: row.id,
    actor: row.actor,
    action: row.action,
    beforeJson: row.before_json,
    afterJson: row.after_json,
    note: row.note,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));
}

export async function getProgressiveAdminMetrics(
  poolKey: ProgressivePoolKey = PROGRESSIVE_POOL_HOODIES,
): Promise<ProgressiveAdminMetrics> {
  assertDb();
  await ensureProgressivePricingTables();
  const state = await computeProgressiveStateFromDb(poolKey);

  const { rows: revenueRows } = await neonQuery<{
    order_count: number;
    revenue: string | number;
  }>(`
    SELECT COUNT(DISTINCT o.id)::int AS order_count,
           COALESCE(SUM(i.price * i.quantity), 0) AS revenue
      FROM shop_orders o
      JOIN order_items i ON i.order_id = o.id
      JOIN products p ON p.id = i.product_id
      LEFT JOIN categories c ON c.id = p.category_id
     WHERE LOWER(COALESCE(o.status, '')) NOT IN ('rejected', 'cancelled')
       AND (
         (
           NULLIF(TRIM(COALESCE(o.xdelivery_barcode, '')), '') IS NOT NULL
           AND UPPER(COALESCE(o.xdelivery_status, '')) IN ('DELIVERED', 'DELIVERED_PAID')
         )
         OR (
           LOWER(COALESCE(o.status, '')) = 'delivered'
           AND (
             NULLIF(TRIM(COALESCE(o.xdelivery_barcode, '')), '') IS NULL
             OR (
               UPPER(COALESCE(o.xdelivery_status, '')) NOT LIKE 'RETURNED%'
               AND UPPER(COALESCE(o.xdelivery_status, '')) <> 'PENDING_RETURNS'
             )
           )
         )
       )
       AND (${HOODIE_CATEGORY_SQL})
  `);

  const hoodieOrderCount = Math.max(0, Math.trunc(Number(revenueRows[0]?.order_count ?? 0)));
  const hoodieRevenue = clampPrice(revenueRows[0]?.revenue ?? 0, 0);
  const averageOrderValue = hoodieOrderCount > 0 ? clampPrice(hoodieRevenue / hoodieOrderCount, 0) : 0;

  const { rows: byLevel } = await neonQuery<{
    unit_price: string | number;
    orders: number;
    revenue: string | number;
  }>(`
    SELECT ROUND(i.price::numeric, 2) AS unit_price,
           COUNT(DISTINCT o.id)::int AS orders,
           COALESCE(SUM(i.price * i.quantity), 0) AS revenue
      FROM shop_orders o
      JOIN order_items i ON i.order_id = o.id
      JOIN products p ON p.id = i.product_id
      LEFT JOIN categories c ON c.id = p.category_id
     WHERE LOWER(COALESCE(o.status, '')) NOT IN ('rejected', 'cancelled')
       AND (${HOODIE_CATEGORY_SQL})
     GROUP BY ROUND(i.price::numeric, 2)
     ORDER BY unit_price ASC
  `);

  const conversionByLevel = (byLevel ?? []).map((row) => {
    const price = clampPrice(row.unit_price, 0);
    const level =
      state.priceIncrement > 0
        ? Math.max(0, Math.round((price - state.basePrice) / state.priceIncrement))
        : 0;
    return {
      level,
      price,
      orders: Math.trunc(Number(row.orders)),
      revenue: clampPrice(row.revenue, 0),
    };
  });

  const [levels, audit] = await Promise.all([listLevels(poolKey), listAudit(poolKey)]);

  return {
    state,
    hoodieRevenue,
    hoodieOrderCount,
    averageOrderValue,
    contributionEstimate: hoodieRevenue,
    contributionNote: "Contribution estimate = hoodie line revenue (COGS not configured).",
    levels,
    audit,
    conversionByLevel,
  };
}
