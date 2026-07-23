import test from "node:test";
import assert from "node:assert/strict";
import { calculateFundTradeAmount, calculateFundTradeShares, calculatePositionFromTrades, markPositionStages } from "../server/services/trades";

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

test("calculatePositionFromTrades counts reinvested dividends only through the added shares", () => {
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
  assert.equal(position.dividendIncome, 50);
  assert.equal(position.realizedProfit, 50);
});

test("calculatePositionFromTrades applies a same-day share increase before a sale", () => {
  const position = calculatePositionFromTrades(
    [
      { id: 1, type: "buy", date: "2026-01-01", nav: 10, amount: 1000, shares: 100, status: "confirmed" },
      { id: 2, type: "sell", date: "2026-02-01", nav: 8, amount: 1120, shares: 140, status: "confirmed" },
    ],
    [
      { id: 1, type: "capital_increase", date: "2026-02-01", amount: null, shares: 40 },
    ],
  );

  assert.equal(position.totalAmount, 0);
  assert.equal(position.totalShares, 0);
  assert.equal(position.realizedCost, 1000);
  assert.equal(position.realizedProfit, 120);
});

test("markPositionStages labels opening and closing trades with share increases", () => {
  const marked = markPositionStages(
    [
      { id: 1, type: "buy", date: "2026-01-01", nav: 10, amount: 1000, shares: 100, status: "confirmed" },
      { id: 2, type: "sell", date: "2026-02-01", nav: 8, amount: 1120, shares: 140, status: "confirmed" },
      { id: 3, type: "buy", date: "2026-03-01", nav: 7, amount: 700, shares: 100, status: "confirmed" },
    ],
    [
      { id: 1, type: "capital_increase", date: "2026-02-01", amount: null, shares: 40 },
    ],
  );

  assert.deepEqual(marked.map((trade) => trade.positionStage), ["opening", "closing", "opening"]);
});

test("calculatePositionFromTrades applies share increases and dividend tax", () => {
  const position = calculatePositionFromTrades(
    [
      { id: 1, type: "buy", date: "2026-01-01", nav: 10, amount: 1000, shares: 100, status: "confirmed" },
    ],
    [
      { id: 1, type: "cash", date: "2026-02-01", amount: 50 },
      { id: 2, type: "capital_increase", date: "2026-02-02", amount: null, shares: 40 },
      { id: 3, type: "dividend_tax", date: "2026-02-03", amount: 5 },
    ],
  );

  assert.equal(position.totalAmount, 1000);
  assert.equal(position.totalShares, 140);
  assert.ok(Math.abs(Number(position.averageCost) - (1000 / 140)) < 0.000000001);
  assert.equal(position.dividendIncome, 45);
  assert.equal(position.realizedProfit, 45);
});

test("calculateFundTradeShares applies fees for fund buys and sells", () => {
  assert.equal(calculateFundTradeShares("buy", 1000, 15, 1.23), (1000 - 15) / 1.23);
  assert.equal(calculateFundTradeShares("sell", 1000, 15, 1.23), (1000 + 15) / 1.23);
  assert.equal(calculateFundTradeShares("buy", 10, 10, 1.23), null);
});

test("calculateFundTradeAmount applies fees for fund sells", () => {
  assert.equal(calculateFundTradeAmount("sell", 800, 12, 1.5), 1188);
  assert.equal(calculateFundTradeAmount("sell", 10, 20, 1), null);
});

test("calculatePositionFromTrades uses net sell proceeds after fees for realized profit", () => {
  const position = calculatePositionFromTrades([
    { id: 1, type: "buy", date: "2026-01-01", nav: 1, amount: 1000, fee: 10, shares: 990, status: "confirmed" },
    { id: 2, type: "sell", date: "2026-01-02", nav: 1.1, amount: 1080, fee: 10, shares: 1000, status: "confirmed" },
  ]);

  assert.equal(position.totalAmount, 0);
  assert.equal(position.totalShares, 0);
  assert.equal(position.realizedAmount, 1080);
  assert.equal(position.realizedCost, 1000);
  assert.equal(position.realizedProfit, 80);
});
