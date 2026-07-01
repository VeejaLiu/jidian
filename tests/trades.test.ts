import test from "node:test";
import assert from "node:assert/strict";
import { calculatePositionFromTrades } from "../server/services/trades";

test("calculatePositionFromTrades tracks open position and realized profit", () => {
  const position = calculatePositionFromTrades([
    { id: 1, type: "buy", date: "2026-01-01", nav: 1, amount: 1000, shares: 1000, status: "confirmed" },
    { id: 2, type: "buy", date: "2026-01-02", nav: 0.8, amount: 800, shares: 1000, status: "confirmed" },
    { id: 3, type: "sell", date: "2026-01-03", nav: 1.1, amount: 1100, shares: 1000, status: "confirmed" },
  ]);

  assert.equal(position.totalAmount, 900);
  assert.equal(position.totalShares, 1000);
  assert.equal(position.averageCost, 0.9);
  assert.equal(position.realizedAmount, 1100);
  assert.equal(position.realizedCost, 900);
  assert.equal(position.realizedProfit, 200);
});

test("calculatePositionFromTrades ignores pending trades", () => {
  const position = calculatePositionFromTrades([
    { id: 1, type: "buy", date: "2026-01-01", nav: 1, amount: 1000, shares: 1000, status: "confirmed" },
    { id: 2, type: "sell", date: "2026-01-02", nav: null, amount: 500, shares: null, status: "pending" },
  ]);

  assert.equal(position.totalAmount, 1000);
  assert.equal(position.totalShares, 1000);
  assert.equal(position.realizedProfit, 0);
});

test("calculatePositionFromTrades includes cash and reinvested dividends", () => {
  const position = calculatePositionFromTrades(
    [
      { id: 1, type: "buy", date: "2026-01-01", nav: 1, amount: 1000, shares: 1000, status: "confirmed" },
    ],
    [
      { id: 1, type: "cash", date: "2026-02-01", amount: 50 },
      { id: 2, type: "reinvest", date: "2026-03-01", amount: 40, nav: 0.8, shares: 50 },
    ],
  );

  assert.equal(position.totalAmount, 1000);
  assert.equal(position.totalShares, 1050);
  assert.equal(position.dividendIncome, 90);
  assert.equal(position.realizedProfit, 90);
});
