import { db } from "../db/database";
import { listTrades, getPosition, calculatePositionFromTrades } from "./trades";

export function getFundById(id: number, options: { includeHidden?: boolean } = {}) {
  const activeFilter = options.includeHidden ? "" : "AND f.is_active = 1";
  return db
    .prepare(
      `SELECT
        f.id,
        f.code,
        f.name,
        f.fund_type,
        COALESCE(s.drop_rate, 0.04) AS drop_rate,
        t.last_buy_date,
        t.last_buy_nav,
        t.latest_nav_date,
        t.latest_nav,
        t.trigger_nav,
        t.required_drop_percent,
        t.status
      FROM funds f
      LEFT JOIN strategy_settings s ON s.fund_id = f.id
      LEFT JOIN fund_trigger_status t ON t.fund_id = f.id
      WHERE f.id = ? ${activeFilter}`,
    )
    .get(id) as any;
}

export function mapFund(row: any) {
  const navHistory = db
    .prepare(
      `SELECT id, nav_date AS date, unit_nav AS nav, accumulated_nav AS accumulatedNav
       FROM nav_history
       WHERE fund_id = ?
       ORDER BY nav_date DESC
       LIMIT 5`,
    )
    .all(row.id);

  const trades = listTrades(row.id, "DESC");
  const position = getPosition(row.id);
  const buys = trades.filter((trade) => trade.type === "buy");

  return {
    id: row.id,
    code: row.code || "",
    name: row.name,
    fundType: row.fund_type || "",
    dropRate: row.drop_rate ?? 0.04,
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
      `SELECT id, nav_date AS date, unit_nav AS nav, accumulated_nav AS accumulatedNav
       FROM nav_history
       WHERE fund_id = ?
       ORDER BY nav_date DESC
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

export function getChartData(fundId: number) {
  const nav = db
    .prepare(
      `SELECT nav_date AS date, unit_nav AS nav
       FROM nav_history
       WHERE fund_id = ?
       ORDER BY nav_date ASC`,
    )
    .all(fundId);
  const trades = listTrades(fundId, "ASC");
  const position = calculatePositionFromTrades(trades);
  const buys = trades.filter((trade) => trade.type === "buy");
  const sells = trades.filter((trade) => trade.type === "sell");

  return { nav, trades, buys, sells, position };
}

export function listFunds(options: { hidden?: boolean } = {}) {
  const isActive = options.hidden ? 0 : 1;
  const rows = db
    .prepare(
      `SELECT
        f.id,
        f.code,
        f.name,
        f.fund_type,
        COALESCE(s.drop_rate, 0.04) AS drop_rate,
        t.last_buy_date,
        t.last_buy_nav,
        t.latest_nav_date,
        t.latest_nav,
        t.trigger_nav,
        t.required_drop_percent,
        t.status
      FROM funds f
      LEFT JOIN strategy_settings s ON s.fund_id = f.id
      LEFT JOIN fund_trigger_status t ON t.fund_id = f.id
      WHERE f.is_active = ?
      ORDER BY f.name COLLATE NOCASE`,
    )
    .all(isActive);

  return rows.map(mapFund);
}
