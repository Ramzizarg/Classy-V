export const DEFAULT_SHIPPING_RATE = 8;

export function normalizeShippingRate(value: unknown): number {
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 ? Math.round(rate * 100) / 100 : DEFAULT_SHIPPING_RATE;
}
