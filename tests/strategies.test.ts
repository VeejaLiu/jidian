import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDropRateStrategy } from "../server/services/strategies";

test("evaluateDropRateStrategy returns trigger state", () => {
  assert.deepEqual(evaluateDropRateStrategy({ lastBuyNav: 1, latestNav: 0.95, dropRate: 0.04 }), {
    state: "triggered",
    triggerNav: 0.96,
    requiredDropPercent: 0,
  });
});

test("evaluateDropRateStrategy returns required drop while waiting", () => {
  assert.deepEqual(evaluateDropRateStrategy({ lastBuyNav: 1, latestNav: 1.2, dropRate: 0.04 }), {
    state: "waiting",
    triggerNav: 0.96,
    requiredDropPercent: 20,
  });
});
