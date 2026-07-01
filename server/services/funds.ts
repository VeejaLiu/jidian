import { db } from "../db/database";
import type { DividendRecord, TradeRecord } from "../types";
import { listDividends } from "./dividends";
import { listTrades, getPosition, calculatePositionFromTrades } from "./trades";
import { getSyncDecision } from "./syncState";

export function getFundById(id: number, options: { includeHidden?: boolean; accountId?: number } = {}) {
  const activeFilter = options.includeHidden ? "" : "AND uf.is_active = 1";
  const accountFilter = options.accountId ? "AND uf.account_id = @accountId" : "";
  return db
    .prepare(
      `SELECT
        f.id,
        f.code,
        f.name,
        f.asset_type,
        f.fund_type,
        COALESCE(uf.drop_rate, s.drop_rate, 0.04) AS drop_rate,
        CASE
          WHEN ns.full_history_synced_at IS NULL THEN ns.last_incremental_sync_at
          WHEN ns.last_incremental_sync_at IS NULL THEN ns.full_history_synced_at
          WHEN ns.full_history_synced_at > ns.last_incremental_sync_at THEN ns.full_history_synced_at
          ELSE ns.last_incremental_sync_at
        END AS last_nav_sync_at,
        t.last_buy_date,
        t.last_buy_nav,
        t.latest_nav_date,
        t.latest_nav,
        t.trigger_nav,
        t.required_drop_percent,
        t.status
      FROM funds f
      JOIN user_funds uf ON uf.fund_id = f.id
      LEFT JOIN strategy_settings s ON s.fund_id = f.id
      LEFT JOIN nav_sync_state ns ON ns.fund_id = f.id
      LEFT JOIN fund_trigger_status t ON t.account_id = uf.account_id AND t.fund_id = f.id
      WHERE f.id = @id ${accountFilter} ${activeFilter}`,
    )
    .get({ id, accountId: options.accountId }) as any;
}

export function mapFund(row: any, accountId: number) {
  const priceHistory = db
    .prepare(
      `SELECT
         id,
         nav_date AS date,
         unit_nav AS nav,
         open_price AS openPrice,
         close_price AS closePrice,
         high_price AS highPrice,
         low_price AS lowPrice,
         accumulated_nav AS accumulatedNav
       FROM nav_history
       WHERE fund_id = ?
       ORDER BY nav_date DESC
       LIMIT 5`,
    )
    .all(row.id);

  const trades = listTrades(row.id, accountId, "DESC");
  const dividends = listDividends(row.id, accountId, "DESC");
  const position = getPosition(row.id, accountId);
  const buys = trades.filter((trade) => trade.type === "buy");
  const syncDecision = getSyncDecision(row.id);

  return {
    id: row.id,
    code: row.code || "",
    name: row.name,
    assetType: row.asset_type || "fund",
    fundType: row.fund_type || "",
    dropRate: row.drop_rate ?? 0.04,
    lastNavSyncAt: row.last_nav_sync_at,
    lastPriceSyncAt: row.last_nav_sync_at,
    status: {
      lastBuyDate: row.last_buy_date,
      lastBuyNav: row.last_buy_nav,
      latestNavDate: row.latest_nav_date,
      latestNav: row.latest_nav,
      latestPriceDate: row.latest_nav_date,
      latestPrice: row.latest_nav,
      triggerNav: row.trigger_nav,
      requiredDropPercent: row.required_drop_percent,
      state: row.status,
    },
    syncStatus: {
      syncing: syncDecision.reason === "syncing",
      reason: syncDecision.reason,
      hasPendingTrade: syncDecision.hasPendingTrade,
      lastTouchedAt: syncDecision.lastTouchedAt || null,
      nextSyncAt: syncDecision.nextSyncAt || null,
      remainingMs: syncDecision.remainingMs,
      intervalMs: syncDecision.interval,
    },
    position: {
      totalAmount: position.totalAmount,
      totalShares: position.totalShares,
      averageCost: position.averageCost,
      displayAverageCost: position.displayAverageCost,
      displayAverageCostLabel: position.displayAverageCostLabel,
      hasOpenPosition: position.hasOpenPosition,
      realizedAmount: position.realizedAmount,
      realizedCost: position.realizedCost,
      dividendIncome: position.dividendIncome,
      realizedProfit: position.realizedProfit,
    },
    navHistory: priceHistory,
    priceHistory,
    trades,
    buys,
    dividends,
  };
}

export function getPaginatedNavHistory(fundId: number, page: unknown, pageSize: unknown) {
  const safePageSize = Math.min(100, Math.max(5, Number(pageSize) || 20));
  const total = (db
    .prepare("SELECT COUNT(*) AS total FROM nav_history WHERE fund_id = ?")
    .get(fundId) as { total: number }).total;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(totalPages, Math.max(1, Number(page) || 1));
  const offset = (safePage - 1) * safePageSize;
  const rows = db
    .prepare(
      `WITH nav_with_change AS (
         SELECT
           id,
           nav_date AS date,
           unit_nav AS nav,
           open_price AS openPrice,
           close_price AS closePrice,
           high_price AS highPrice,
           low_price AS lowPrice,
           accumulated_nav AS accumulatedNav,
           LAG(unit_nav) OVER (ORDER BY nav_date ASC, id ASC) AS previousNav
         FROM nav_history
         WHERE fund_id = ?
       )
       SELECT
         id,
         date,
         nav,
         accumulatedNav,
         previousNav,
         CASE
           WHEN previousNav IS NULL OR previousNav <= 0 THEN NULL
           ELSE ROUND((nav - previousNav) / previousNav * 100, 4)
         END AS dailyChangePercent
       FROM nav_with_change
       ORDER BY date DESC
       LIMIT ? OFFSET ?`,
    )
    .all(fundId, safePageSize, offset);

  return {
    rows,
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
  };
}

export function getPaginatedPriceHistory(fundId: number, page: unknown, pageSize: unknown) {
  return getPaginatedNavHistory(fundId, page, pageSize);
}

export function getChartData(fundId: number, accountId: number) {
  const nav = db
    .prepare(
      `WITH nav_with_change AS (
         SELECT
           nav_date AS date,
           unit_nav AS nav,
           open_price AS openPrice,
           close_price AS closePrice,
           high_price AS highPrice,
           low_price AS lowPrice,
           LAG(unit_nav) OVER (ORDER BY nav_date ASC, id ASC) AS previousNav
         FROM nav_history
         WHERE fund_id = ?
       )
       SELECT
         date,
         nav,
         previousNav,
         CASE
           WHEN previousNav IS NULL OR previousNav <= 0 THEN NULL
           ELSE ROUND((nav - previousNav) / previousNav * 100, 4)
         END AS dailyChangePercent
       FROM nav_with_change
       ORDER BY date ASC`,
    )
    .all(fundId);
  const trades = listTrades(fundId, accountId, "ASC");
  const dividends = listDividends(fundId, accountId, "ASC");
  const position = calculatePositionFromTrades(trades, dividends);
  const buys = trades.filter((trade) => trade.type === "buy");
  const sells = trades.filter((trade) => trade.type === "sell");

  return { nav, trades, buys, sells, dividends, position };
}

export function listFunds(accountId: number, options: { hidden?: boolean } = {}) {
  const isActive = options.hidden ? 0 : 1;
  const rows = db
    .prepare(
      `SELECT
        f.id,
        f.code,
        f.name,
        f.asset_type,
        f.fund_type,
        COALESCE(uf.drop_rate, s.drop_rate, 0.04) AS drop_rate,
        CASE
          WHEN ns.full_history_synced_at IS NULL THEN ns.last_incremental_sync_at
          WHEN ns.last_incremental_sync_at IS NULL THEN ns.full_history_synced_at
          WHEN ns.full_history_synced_at > ns.last_incremental_sync_at THEN ns.full_history_synced_at
          ELSE ns.last_incremental_sync_at
        END AS last_nav_sync_at,
        t.last_buy_date,
        t.last_buy_nav,
        t.latest_nav_date,
        t.latest_nav,
        t.trigger_nav,
        t.required_drop_percent,
        t.status
      FROM funds f
      JOIN user_funds uf ON uf.fund_id = f.id
      LEFT JOIN strategy_settings s ON s.fund_id = f.id
      LEFT JOIN nav_sync_state ns ON ns.fund_id = f.id
      LEFT JOIN fund_trigger_status t ON t.account_id = uf.account_id AND t.fund_id = f.id
      WHERE uf.account_id = ?
        AND uf.is_active = ?
      ORDER BY f.name COLLATE NOCASE`,
    )
    .all(accountId, isActive);

  return rows.map((row) => mapFund(row, accountId));
}

export function getAccountSummary(accountId: number) {
  const funds = listFunds(accountId);
  const assets = funds.map((fund) => {
    const totalCost = Number(fund.position?.totalAmount || 0);
    const totalShares = Number(fund.position?.totalShares || 0);
    const realizedProfit = Number(fund.position?.realizedProfit || 0);
    const latestPrice = Number(fund.status?.latestPrice ?? fund.status?.latestNav);
    const marketValue = Number.isFinite(latestPrice) && totalShares > 0 ? latestPrice * totalShares : 0;
    const totalProfit = marketValue - totalCost + realizedProfit;
    const xirr = calculateAssetXirr(fund.trades || [], fund.dividends || [], marketValue);
    const cashFlows = buildCashFlowsForXirr({ trades: fund.trades || [], dividends: fund.dividends || [] }, marketValue);
    return {
      id: fund.id,
      name: fund.name,
      code: fund.code,
      assetType: fund.assetType,
      totalCost,
      totalShares,
      latestPrice: Number.isFinite(latestPrice) ? latestPrice : null,
      marketValue,
      realizedProfit,
      totalProfit,
      xirr,
      cashFlows,
    };
  });

  const totals = assets.reduce(
    (sum, asset) => {
      sum.totalCost += asset.totalCost;
      sum.marketValue += asset.marketValue;
      sum.realizedProfit += asset.realizedProfit;
      sum.totalProfit += asset.totalProfit;
      sum.cashFlows.push(...asset.cashFlows);
      if (asset.assetType === "stock") sum.stockMarketValue += asset.marketValue;
      else sum.fundMarketValue += asset.marketValue;
      return sum;
    },
    {
      totalCost: 0,
      marketValue: 0,
      realizedProfit: 0,
      totalProfit: 0,
      fundMarketValue: 0,
      stockMarketValue: 0,
      cashFlows: [] as CashFlow[],
    },
  );
  const accountXirr = calculateXirr(totals.cashFlows);

  return {
    accountId,
    totals: {
      totalCost: totals.totalCost,
      marketValue: totals.marketValue,
      realizedProfit: totals.realizedProfit,
      totalProfit: totals.totalProfit,
      fundMarketValue: totals.fundMarketValue,
      stockMarketValue: totals.stockMarketValue,
      totalProfitRate: totals.totalCost > 0 ? (totals.totalProfit / totals.totalCost) * 100 : null,
      xirr: accountXirr,
      assetCount: assets.length,
    },
    assets: assets.map(({ cashFlows, ...asset }) => asset),
  };
}

type CashFlow = { date: string; amount: number };

function buildCashFlowsForXirr(asset: { trades?: TradeRecord[]; dividends?: DividendRecord[] }, marketValue: number) {
  const flows: CashFlow[] = [];
  (asset.trades || []).forEach((trade) => {
    if (trade.status === "pending") return;
    const amount = Number(trade.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    flows.push({ date: trade.date, amount: trade.type === "buy" ? -amount : amount });
  });
  (asset.dividends || []).forEach((dividend) => {
    if (dividend.type !== "cash") return;
    const amount = Number(dividend.amount);
    if (Number.isFinite(amount) && amount > 0) flows.push({ date: dividend.date, amount });
  });
  if (marketValue > 0) flows.push({ date: new Date().toISOString().slice(0, 10), amount: marketValue });
  return flows;
}

function calculateAssetXirr(trades: TradeRecord[], dividends: DividendRecord[], marketValue: number) {
  return calculateXirr(buildCashFlowsForXirr({ trades, dividends }, marketValue));
}

function calculateXirr(flows: CashFlow[]) {
  if (flows.length < 2 || !flows.some((flow) => flow.amount < 0) || !flows.some((flow) => flow.amount > 0)) return null;
  const sorted = [...flows].sort((left, right) => left.date.localeCompare(right.date));
  const start = new Date(`${sorted[0].date}T00:00:00`).getTime();
  if (Number.isNaN(start)) return null;

  const npv = (rate: number) => sorted.reduce((sum, flow) => {
    const time = new Date(`${flow.date}T00:00:00`).getTime();
    if (Number.isNaN(time)) return sum;
    const years = (time - start) / (365 * 24 * 60 * 60 * 1000);
    return sum + flow.amount / ((1 + rate) ** years);
  }, 0);

  let low = -0.9999;
  let high = 10;
  let lowValue = npv(low);
  let highValue = npv(high);
  if (lowValue * highValue > 0) return null;

  for (let index = 0; index < 80; index += 1) {
    const mid = (low + high) / 2;
    const midValue = npv(mid);
    if (Math.abs(midValue) < 0.000001) return mid * 100;
    if (lowValue * midValue <= 0) {
      high = mid;
      highValue = midValue;
    } else {
      low = mid;
      lowValue = midValue;
    }
  }
  return ((low + high) / 2) * 100;
}
