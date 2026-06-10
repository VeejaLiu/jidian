import { db } from "../db/database";
import { listTrades, getPosition, calculatePositionFromTrades } from "./trades";

export function getFundById(id: number, options: { includeHidden?: boolean; accountId?: number } = {}) {
  const activeFilter = options.includeHidden ? "" : "AND uf.is_active = 1";
  const accountFilter = options.accountId ? "AND uf.account_id = @accountId" : "";
  return db
    .prepare(
      `SELECT
        f.id,
        f.code,
        f.name,
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
  const navHistory = db
    .prepare(
      `SELECT id, nav_date AS date, unit_nav AS nav, accumulated_nav AS accumulatedNav
       FROM nav_history
       WHERE fund_id = ?
       ORDER BY nav_date DESC
       LIMIT 5`,
    )
    .all(row.id);

  const trades = listTrades(row.id, accountId, "DESC");
  const position = getPosition(row.id, accountId);
  const buys = trades.filter((trade) => trade.type === "buy");

  return {
    id: row.id,
    code: row.code || "",
    name: row.name,
    fundType: row.fund_type || "",
    dropRate: row.drop_rate ?? 0.04,
    lastNavSyncAt: row.last_nav_sync_at,
    status: {
      lastBuyDate: row.last_buy_date,
      lastBuyNav: row.last_buy_nav,
      latestNavDate: row.latest_nav_date,
      latestNav: row.latest_nav,
      triggerNav: row.trigger_nav,
      requiredDropPercent: row.required_drop_percent,
      state: row.status,
    },
    position: {
      totalAmount: position.totalAmount,
      totalShares: position.totalShares,
      averageCost: position.averageCost,
    },
    navHistory,
    trades,
    buys,
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

export function getChartData(fundId: number, accountId: number) {
  const nav = db
    .prepare(
      `WITH nav_with_change AS (
         SELECT
           nav_date AS date,
           unit_nav AS nav,
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
  const position = calculatePositionFromTrades(trades);
  const buys = trades.filter((trade) => trade.type === "buy");
  const sells = trades.filter((trade) => trade.type === "sell");

  return { nav, trades, buys, sells, position };
}

export function listFunds(accountId: number, options: { hidden?: boolean } = {}) {
  const isActive = options.hidden ? 0 : 1;
  const rows = db
    .prepare(
      `SELECT
        f.id,
        f.code,
        f.name,
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
