import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PROGRESSIVE_CONFIG,
  computeProgressiveState,
  isHoodieCategorySlug,
  priceAtDelivered,
} from "./progressivePricing.ts";

describe("progressive pricing formula", () => {
  const cfg = DEFAULT_PROGRESSIVE_CONFIG;

  it("keeps 55 DT for 0–9 delivered", () => {
    for (const n of [0, 1, 7, 9]) {
      assert.equal(priceAtDelivered(n, cfg), 55);
      const state = computeProgressiveState(n, cfg);
      assert.equal(state.currentPrice, 55);
      assert.equal(state.nextPrice, 60);
      assert.equal(state.level, 0);
      assert.equal(state.remaining, 10 - n);
      assert.equal(state.progressInLevel, n);
    }
  });

  it("steps +5 every 10 delivered orders", () => {
    assert.equal(priceAtDelivered(10, cfg), 60);
    assert.equal(priceAtDelivered(19, cfg), 60);
    assert.equal(priceAtDelivered(20, cfg), 65);
    assert.equal(priceAtDelivered(30, cfg), 70);
    assert.equal(priceAtDelivered(50, cfg), 80);
    assert.equal(computeProgressiveState(7, cfg).progressPct, 70);
    assert.equal(computeProgressiveState(10, cfg).progressPct, 0);
    assert.equal(computeProgressiveState(10, cfg).remaining, 10);
  });

  it("applies manual offset without resetting by month", () => {
    const withOffset = { ...cfg, manualOrderOffset: 3 };
    assert.equal(priceAtDelivered(7, withOffset), 60); // effective 10
    const negative = { ...cfg, manualOrderOffset: -5 };
    assert.equal(priceAtDelivered(12, negative), 55); // effective 7
  });

  it("reports disabled flag without changing math helpers", () => {
    const state = computeProgressiveState(12, { ...cfg, enabled: false });
    assert.equal(state.enabled, false);
    assert.equal(state.currentPrice, 60);
  });
});

describe("hoodie category detection", () => {
  it("accepts hoodies / hoodie variants", () => {
    assert.equal(isHoodieCategorySlug("hoodies"), true);
    assert.equal(isHoodieCategorySlug("Hoodie"), true);
    assert.equal(isHoodieCategorySlug("sweatpants"), false);
  });
});

describe("idempotent delivered counting", () => {
  /** Mirrors DISTINCT order_id counting — duplicate status events must not double-count. */
  function countDistinctQualifying(
    events: Array<{ orderId: number; qualifies: boolean }>,
  ): number {
    const qualifying = new Set<number>();
    for (const event of events) {
      if (event.qualifies) qualifying.add(event.orderId);
      else qualifying.delete(event.orderId);
    }
    return qualifying.size;
  }

  it("ignores duplicate delivered events for the same order", () => {
    const count = countDistinctQualifying([
      { orderId: 1, qualifies: true },
      { orderId: 1, qualifies: true },
      { orderId: 1, qualifies: true },
      { orderId: 2, qualifies: true },
    ]);
    assert.equal(count, 2);
    assert.equal(priceAtDelivered(count, DEFAULT_PROGRESSIVE_CONFIG), 55);
  });

  it("drops returned / cancelled orders from the live set", () => {
    const count = countDistinctQualifying([
      { orderId: 1, qualifies: true },
      { orderId: 2, qualifies: true },
      { orderId: 3, qualifies: true },
      { orderId: 2, qualifies: false }, // returned
      { orderId: 3, qualifies: false }, // cancelled
    ]);
    assert.equal(count, 1);
  });

  it("handles concurrent-looking updates safely via set semantics", () => {
    const concurrent = Array.from({ length: 20 }, () => ({ orderId: 99, qualifies: true }));
    assert.equal(countDistinctQualifying(concurrent), 1);
  });
});
