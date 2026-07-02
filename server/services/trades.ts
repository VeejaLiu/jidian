import { db } from "../db/database";
import type { DividendRecord, TradeRecord } from "../types";
import { toHttpError } from "../utils/httpError";
import { assertDate, assertPositiveNumber, cleanText, optionalPositiveNumber } from "../utils/validators";

export function calculateFundTradeShares(type: "buy" | "sell", amount: number, fee: number, nav: number) {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(fee) || fee < 0 || !Number.isFinite(nav) || nav <= 0) {
    return null;
  }

  const netAmount = type === "buy" ? amount - fee : amount + fee;
  if (netAmount <= 0) return null;
  return netAmount / nav;
}

export function calculateFundTradeAmount(type: "buy" | "sell", shares: number, fee: number, nav: number) {
  if (!Number.isFinite(shares) || shares <= 0 || !Number.isFinite(fee) || fee < 0 || !Number.isFinite(nav) || nav <= 0) {
    return null;
  }

  const grossAmount = shares * nav;
  const netAmount = type === "buy" ? grossAmount + fee : grossAmount - fee;
  if (netAmount <= 0) return null;
  return Number(netAmount.toFixed(2));
}

export function listTrades(fundId: number, accountId: number, order: "ASC" | "DESC" = "DESC") {
  const direction = order === "ASC" ? "ASC" : "DESC";
  return db
    .prepare(
      `SELECT
        id,
        trade_type AS type,
        trade_date AS date,
        trade_nav AS nav,
        amount,
        fee,
        shares,
        status,
        note
       FROM trade_records
       WHERE fund_id = ?
         AND account_id = ?
       ORDER BY trade_date ${direction}, id ${direction}`,
    )
    .all(fundId, accountId) as TradeRecord[];
}

export function calculatePositionFromTrades(trades: TradeRecord[], dividends: DividendRecord[] = []) {
  let totalAmount = 0;
  let totalShares = 0;
  let realizedAmount = 0;
  let realizedCost = 0;
  let dividendIncome = 0;
  let cycleBoughtAmount = 0;
  let cycleBoughtShares = 0;
  let cycleRealizedCost = 0;
  let cycleSoldShares = 0;
  let lastClosedAverageCost: number | null = null;

  const timeline = [
    ...trades.filter((trade) => trade.status !== "pending").map((trade) => ({ kind: "trade" as const, date: trade.date, id: Number(trade.id || 0), trade })),
    ...dividends.map((dividend) => ({ kind: "dividend" as const, date: dividend.date, id: Number(dividend.id || 0), dividend })),
  ].sort((left, right) => {
    if (left.date === right.date) {
      if (left.kind === right.kind) return left.id - right.id;
      return left.kind === "trade" ? -1 : 1;
    }
    return left.date.localeCompare(right.date);
  });

  timeline.forEach((item) => {
    if (item.kind === "dividend") {
      const amount = Number(item.dividend.amount);
      if (!Number.isFinite(amount) || amount <= 0) return;
      dividendIncome += amount;
      if (item.dividend.type === "reinvest") {
        const shares = Number(item.dividend.shares);
        if (Number.isFinite(shares) && shares > 0) totalShares += shares;
      }
      return;
    }

    const amount = Number(item.trade.amount);
    const shares = Number(item.trade.shares);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(shares) || shares <= 0) return;

    if (item.trade.type === "buy") {
      if (totalShares <= 0) {
        cycleBoughtAmount = 0;
        cycleBoughtShares = 0;
        cycleRealizedCost = 0;
        cycleSoldShares = 0;
      }
      totalAmount += amount;
      totalShares += shares;
      cycleBoughtAmount += amount;
      cycleBoughtShares += shares;
      return;
    }

    if (item.trade.type === "sell") {
      const soldShares = Math.min(shares, totalShares);
      if (soldShares <= 0) return;
      const averageCost = totalShares > 0 ? totalAmount / totalShares : 0;
      const costReduction = averageCost * soldShares;
      totalAmount -= costReduction;
      totalShares -= soldShares;
      realizedAmount += amount;
      realizedCost += costReduction;
      cycleRealizedCost += costReduction;
      cycleSoldShares += soldShares;

      if (Math.abs(totalAmount) < 0.000001) totalAmount = 0;
      if (Math.abs(totalShares) < 0.000001) totalShares = 0;

      if (totalShares === 0 && cycleSoldShares > 0) {
        lastClosedAverageCost = cycleRealizedCost / cycleSoldShares;
      }
    }
  });

  const hasOpenPosition = totalShares > 0;
  const displayAverageCost = hasOpenPosition
    ? (totalShares > 0 ? totalAmount / totalShares : null)
    : lastClosedAverageCost;
  const displayAverageCostLabel = hasOpenPosition ? "当前成本价" : lastClosedAverageCost !== null ? "最近一轮成本价" : "成本价";

  return {
    totalAmount,
    totalShares,
    averageCost: totalShares > 0 ? totalAmount / totalShares : null,
    displayAverageCost,
    displayAverageCostLabel,
    hasOpenPosition,
    realizedAmount,
    realizedCost,
    dividendIncome,
    realizedProfit: realizedAmount - realizedCost + dividendIncome,
  };
}

const SELL_AMOUNT_TOLERANCE = 0.01;

function findNegativePositionState(trades: TradeRecord[]) {
  let totalShares = 0;

  for (const trade of trades.filter((item) => item.status !== "pending")) {
    const shares = Number(trade.shares);
    if (!Number.isFinite(shares) || shares <= 0) continue;

    if (trade.type === "buy") {
      totalShares += shares;
    } else if (trade.type === "sell") {
      totalShares -= shares;
    }

    if (totalShares < -0.000001) {
      return {
        trade,
        deficitShares: Math.abs(totalShares),
      };
    }
  }

  return null;
}

function sortTradesByTimeline(trades: TradeRecord[]) {
  return [...trades].sort((left, right) => {
    if (left.date === right.date) {
      if (left.type === right.type) return Number(left.id || 0) - Number(right.id || 0);
      return left.type === "buy" ? -1 : 1;
    }
    return left.date.localeCompare(right.date);
  });
}

export function getPosition(fundId: number, accountId: number) {
  const dividends = db
    .prepare(
      `SELECT id, dividend_type AS type, dividend_date AS date, amount, dividend_nav AS nav, shares, note
       FROM dividend_records
       WHERE fund_id = ?
         AND account_id = ?
       ORDER BY dividend_date ASC, id ASC`,
    )
    .all(fundId, accountId) as DividendRecord[];
  return calculatePositionFromTrades(listTrades(fundId, accountId, "ASC"), dividends);
}

export function buildTradeInput(fundId: number, body: any, forcedType: "buy" | "sell" | null = null): TradeRecord {
  const tradeType = forcedType || cleanText(body.type);
  if (!["buy", "sell"].includes(tradeType)) {
    throw toHttpError("交易类型必须是买入或卖出", 400);
  }

  const asset = db.prepare("SELECT asset_type FROM funds WHERE id = ?").get(fundId) as { asset_type?: string } | undefined;
  const isStock = asset?.asset_type === "stock";
  const tradeDate = assertDate(body.date, "交易日期");
  let amount: number | null = null;
  let fee = 0;
  let nav = optionalPositiveNumber(body.nav, isStock ? "成交价格" : "交易净值");
  let shares = optionalPositiveNumber(body.shares, isStock ? "成交股数" : "交易份额");
  let status: "pending" | "confirmed" = "confirmed";

  if (isStock) {
    nav = assertPositiveNumber(body.nav, tradeType === "buy" ? "买入价格" : "卖出价格");
    shares = assertPositiveNumber(body.shares, tradeType === "buy" ? "买入股数" : "卖出股数");
    fee = Number(body.fee || 0);
    if (!Number.isFinite(fee) || fee < 0) {
      throw toHttpError("税费不能小于 0", 400);
    }
    const grossAmount = nav * shares;
    amount = Number((tradeType === "buy" ? grossAmount + fee : grossAmount - fee).toFixed(2));
    if (amount <= 0) {
      throw toHttpError("扣除税费后的成交金额必须大于 0", 400);
    }
  } else {
    fee = Number(body.fee || 0);
    if (!Number.isFinite(fee) || fee < 0) {
      throw toHttpError("手续费不能小于 0", 400);
    }
    if (tradeType === "sell" && shares) {
      if (nav) {
        amount = calculateFundTradeAmount("sell", shares, fee, nav);
        if (amount == null) {
          throw toHttpError("扣除手续费后的卖出金额必须大于 0", 400);
        }
      }
    } else {
      amount = assertPositiveNumber(body.amount, tradeType === "buy" ? "买入金额" : "卖出金额");
      if (tradeType === "buy" && amount <= fee) {
        throw toHttpError("买入金额必须大于手续费", 400);
      }
    }
  }

  if (!isStock && !nav) {
    const navRow = db
      .prepare("SELECT unit_nav FROM nav_history WHERE fund_id = ? AND nav_date = ?")
      .get(fundId, tradeDate) as { unit_nav?: number } | undefined;
    if (!navRow) {
      status = "pending";
      nav = null;
    } else {
      nav = Number(navRow.unit_nav);
    }
  }

  if (!isStock && tradeType === "sell" && shares && nav) {
    amount = calculateFundTradeAmount("sell", shares, fee, nav);
    if (amount == null) {
      throw toHttpError("扣除手续费后的卖出金额必须大于 0", 400);
    }
  }

  if (!isStock && tradeType === "sell" && !shares) {
    if (amount == null) {
      throw toHttpError("卖出金额或卖出份额至少填写一个", 400);
    }
    if (nav) {
      shares = calculateFundTradeShares("sell", amount, fee, nav);
      if (shares == null) {
        throw toHttpError("无法根据卖出金额和手续费计算卖出份额", 400);
      }
    }
  }

  if (!isStock && tradeType === "buy" && amount == null) {
    throw toHttpError("买入金额不能为空", 400);
  }

  if (!isStock && tradeType === "sell" && amount == null && !shares) {
    throw toHttpError("卖出份额不能为空", 400);
  }

  return {
    type: tradeType as "buy" | "sell",
    date: tradeDate,
    nav,
    amount,
    fee,
    shares: isStock
      ? shares
      : tradeType === "buy"
        ? (nav && amount != null ? calculateFundTradeShares("buy", amount, fee, nav) : null)
        : (shares || null),
    status,
    note: cleanText(body.note),
  };
}

export function assertTradeTimeline(fundId: number, accountId: number, candidateTrade: TradeRecord, ignoredTradeId: number | null = null) {
  if (candidateTrade.status === "pending") return;
  const existingTrades = listTrades(fundId, accountId, "ASC").filter((trade) => trade.id !== ignoredTradeId);
  const candidateTrades = sortTradesByTimeline([...existingTrades, candidateTrade]);
  const negativeState = findNegativePositionState(candidateTrades);
  if (negativeState) {
    const nav = Number(negativeState.trade.nav);
    const allowedDeficitShares = Number.isFinite(nav) && nav > 0 ? SELL_AMOUNT_TOLERANCE / nav : 0;
    if (negativeState.deficitShares <= allowedDeficitShares + 0.000001) return;
    throw toHttpError("卖出份额超过当前持有份额", 400);
  }
}
