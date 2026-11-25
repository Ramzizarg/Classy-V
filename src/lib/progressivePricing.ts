/** Pure progressive-pricing math — no DB. Hoodie pool defaults match the business brief. */

export const PROGRESSIVE_POOL_HOODIES = "hoodies" as const;
export const PROGRESSIVE_CURRENCY = "DT" as const;

export type ProgressivePoolKey = typeof PROGRESSIVE_POOL_HOODIES | string;

export type ProgressiveConfig = {
  poolKey: ProgressivePoolKey;
  enabled: boolean;
  basePrice: number;
  milestoneInterval: number;
  priceIncrement: number;
  manualOrderOffset: number;
};

export type ProgressiveState = ProgressiveConfig & {
  deliveredOrders: number;
  effectiveDelivered: number;
  level: number;
  currentPrice: number;
  nextPrice: number;
  remaining: number;
  progressInLevel: number;
  progressPct: number;
};

export const DEFAULT_PROGRESSIVE_CONFIG: ProgressiveConfig = {
  poolKey: PROGRESSIVE_POOL_HOODIES,
  enabled: true,
  basePrice: 55,
  milestoneInterval: 10,
  priceIncrement: 5,
  manualOrderOffset: 0,
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clampInterval(raw: unknown): number {
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_PROGRESSIVE_CONFIG.milestoneInterval;
}

export function clampPrice(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return round2(n);
}

export function clampOffset(raw: unknown): number {
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) ? n : 0;
}

/** price = base + floor(effectiveDelivered / interval) × increment */
export function priceAtDelivered(
  delivered: number,
  config: Pick<ProgressiveConfig, "basePrice" | "milestoneInterval" | "priceIncrement" | "manualOrderOffset">,
): number {
  const interval = clampInterval(config.milestoneInterval);
  const effective = Math.max(0, Math.trunc(delivered) + clampOffset(config.manualOrderOffset));
  const level = Math.floor(effective / interval);
  return round2(clampPrice(config.basePrice, 55) + level * clampPrice(config.priceIncrement, 5));
}

export function computeProgressiveState(
  deliveredOrders: number,
  config: ProgressiveConfig = DEFAULT_PROGRESSIVE_CONFIG,
): ProgressiveState {
  const interval = clampInterval(config.milestoneInterval);
  const basePrice = clampPrice(config.basePrice, DEFAULT_PROGRESSIVE_CONFIG.basePrice);
  const priceIncrement = clampPrice(config.priceIncrement, DEFAULT_PROGRESSIVE_CONFIG.priceIncrement);
  const manualOrderOffset = clampOffset(config.manualOrderOffset);
  const delivered = Math.max(0, Math.trunc(deliveredOrders));
  const effectiveDelivered = Math.max(0, delivered + manualOrderOffset);
  const level = Math.floor(effectiveDelivered / interval);
  const progressInLevel = effectiveDelivered % interval;
  const remaining = interval - progressInLevel;
  const currentPrice = round2(basePrice + level * priceIncrement);
  const nextPrice = round2(currentPrice + priceIncrement);
  const progressPct = Math.min(100, Math.round((progressInLevel / interval) * 100));

  return {
    poolKey: config.poolKey,
    enabled: Boolean(config.enabled),
    basePrice,
    milestoneInterval: interval,
    priceIncrement,
    manualOrderOffset,
    deliveredOrders: delivered,
    effectiveDelivered,
    level,
    currentPrice,
    nextPrice,
    remaining,
    progressInLevel,
    progressPct,
  };
}

/** Public aggregate payload — no PII. */
export function toPublicProgressivePayload(state: ProgressiveState) {
  return {
    enabled: state.enabled,
    currentPrice: state.currentPrice,
    deliveredOrders: state.deliveredOrders,
    remaining: state.remaining,
    nextPrice: state.nextPrice,
    progressPct: state.progressPct,
    progressInLevel: state.progressInLevel,
    milestoneInterval: state.milestoneInterval,
    priceIncrement: state.priceIncrement,
    level: state.level,
    currency: PROGRESSIVE_CURRENCY,
  };
}

export function isHoodieCategorySlug(slug: string | null | undefined): boolean {
  const normalized = (slug ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_/g, "-");
  return normalized === "hoodies" || normalized === "hoodie";
}

export type ProgressiveLevelRow = {
  level: number;
  price: number;
  deliveredOrdersAt: number;
  createdAt: string;
};

export type ProgressiveAuditRow = {
  id: number;
  actor: string | null;
  action: string;
  beforeJson: unknown;
  afterJson: unknown;
  note: string | null;
  createdAt: string;
};

export type ProgressiveAdminMetrics = {
  state: ProgressiveState;
  hoodieRevenue: number;
  hoodieOrderCount: number;
  averageOrderValue: number;
  contributionEstimate: number;
  contributionNote: string;
  levels: ProgressiveLevelRow[];
  audit: ProgressiveAuditRow[];
  conversionByLevel: Array<{
    level: number;
    price: number;
    orders: number;
    revenue: number;
  }>;
};
