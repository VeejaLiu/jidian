import { db } from "../db/database";
import { addDaysISO, todayISO } from "../utils/date";
import { toHttpError } from "../utils/httpError";
import { getFundById } from "./funds";
import { fetchNavHistory } from "./eastmoney";
import { assertTradeTimeline } from "./trades";

const navSyncJobs = new Set<number>();
const navSyncTouchedAt = new Map<number, number>();
const NAV_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const PENDING_TRADE_SYNC_INTERVAL_MS = 5 * 60 * 1000;

function getDefaultSyncStartDate(fundId: number) {
  const syncState = db
    .prepare("SELECT full_history_synced FROM nav_sync_state WHERE fund_id = ?")
    .get(fundId) as { full_history_synced?: number } | undefined;
  if (!syncState?.full_history_synced) return "";

  const latest = db
    .prepare("SELECT nav_date FROM nav_history WHERE fund_id = ? ORDER BY nav_date DESC LIMIT 1")
    .get(fundId) as { nav_date?: string } | undefined;

  if (latest?.nav_date) {
    return addDaysISO(latest.nav_date, 1);
  }

  return "";
}

function shouldSkipSync(fundId: number) {
  const lastTouchedAt = navSyncTouchedAt.get(fundId) || 0;
  const pendingTrade = db
    .prepare("SELECT 1 FROM trade_records WHERE fund_id = ? AND status = 'pending' LIMIT 1")
    .get(fundId);
  const interval = pendingTrade ? PENDING_TRADE_SYNC_INTERVAL_MS : NAV_SYNC_INTERVAL_MS;
  return Date.now() - lastTouchedAt < interval || navSyncJobs.has(fundId);
}

const upsertNav = db.prepare(
  `INSERT INTO nav_history (fund_id, nav_date, unit_nav, accumulated_nav, source)
   VALUES (@fundId, @date, @nav, @accumulatedNav, 'eastmoney')
   ON CONFLICT(fund_id, nav_date) DO UPDATE SET
     unit_nav = excluded.unit_nav,
     accumulated_nav = excluded.accumulated_nav,
     source = excluded.source`,
);

const upsertNavSyncState = db.prepare(
  `INSERT INTO nav_sync_state (
     fund_id,
     full_history_synced,
     full_history_synced_at,
     last_incremental_sync_at
   )
   VALUES (@fundId, @fullHistorySynced, @fullHistorySyncedAt, @lastIncrementalSyncAt)
   ON CONFLICT(fund_id) DO UPDATE SET
     full_history_synced = CASE
       WHEN excluded.full_history_synced = 1 THEN 1
       ELSE nav_sync_state.full_history_synced
     END,
     full_history_synced_at = COALESCE(excluded.full_history_synced_at, nav_sync_state.full_history_synced_at),
     last_incremental_sync_at = COALESCE(excluded.last_incremental_sync_at, nav_sync_state.last_incremental_sync_at)`,
);

function confirmPendingTrades(fundId: number) {
  const pendingTrades = db
    .prepare(
      `SELECT id, trade_type AS type, trade_date AS date, amount
       FROM trade_records
       WHERE fund_id = ?
         AND status = 'pending'`,
    )
    .all(fundId) as Array<{ id: number; type: "buy" | "sell"; date: string; amount: number }>;

  const navForDate = db.prepare(
    "SELECT unit_nav FROM nav_history WHERE fund_id = ? AND nav_date = ?",
  );
  const confirmTrade = db.prepare(
    `UPDATE trade_records
     SET trade_nav = ?,
         shares = ?,
         status = 'confirmed',
         confirmed_at = ?
     WHERE id = ?`,
  );

  const confirmedAt = new Date().toISOString();
  let confirmed = 0;
  pendingTrades.forEach((trade) => {
    const navRow = navForDate.get(fundId, trade.date) as { unit_nav?: number } | undefined;
    const nav = Number(navRow?.unit_nav);
    if (!Number.isFinite(nav) || nav <= 0) return;

    const shares = trade.amount / nav;
    try {
      assertTradeTimeline(
        fundId,
        {
          id: trade.id,
          type: trade.type,
          date: trade.date,
          nav,
          amount: trade.amount,
          shares,
          status: "confirmed",
        },
        trade.id,
      );
    } catch (error) {
      console.warn(`待确认交易无法自动确认 trade_id=${trade.id}: ${(error as Error).message}`);
      return;
    }

    confirmTrade.run(nav, shares, confirmedAt, trade.id);
    confirmed += 1;
  });

  return confirmed;
}

export async function syncFundNav(fundId: number, options: { startDate?: string; endDate?: string; fullHistory?: boolean } = {}) {
  if (navSyncJobs.has(fundId)) return { imported: 0, skipped: true, reason: "syncing" };

  const fund = getFundById(fundId);
  if (!fund) throw toHttpError("基金不存在", 404);
  if (!fund.code) throw toHttpError("请先填写基金代码", 400);

  const startDate = options.fullHistory ? "" : options.startDate ?? getDefaultSyncStartDate(fundId);
  const endDate = options.endDate || "";
  if (startDate > todayISO()) {
    navSyncTouchedAt.set(fundId, Date.now());
    return { imported: 0, startDate, endDate: endDate || null, skipped: true, reason: "up-to-date" };
  }

  navSyncJobs.add(fundId);
  try {
    const result = await fetchNavHistory(fund.code, startDate, endDate);
    const transaction = db.transaction((rows: typeof result.rows) => {
      rows.forEach((row) => {
        upsertNav.run({
          fundId,
          date: row.date,
          nav: row.nav,
          accumulatedNav: row.accumulatedNav,
        });
      });
    });
    transaction(result.rows);
    const confirmedTrades = confirmPendingTrades(fundId);
    navSyncTouchedAt.set(fundId, Date.now());
    upsertNavSyncState.run({
      fundId,
      fullHistorySynced: startDate ? 0 : 1,
      fullHistorySyncedAt: startDate ? null : new Date().toISOString(),
      lastIncrementalSyncAt: new Date().toISOString(),
    });

    return {
      imported: result.rows.length,
      mode: startDate ? "incremental" : "full",
      startDate,
      endDate: endDate || null,
      sourceRecords: result.sourceRecords,
      sourcePages: result.sourcePages,
      fetchedPages: result.fetchedPages,
      confirmedTrades,
    };
  } finally {
    navSyncJobs.delete(fundId);
  }
}

export function syncActiveFundsInBackground() {
  const funds = db
    .prepare("SELECT id FROM funds WHERE is_active = 1 AND code IS NOT NULL AND code != ''")
    .all() as Array<{ id: number }>;

  funds.forEach((fund) => {
    if (shouldSkipSync(fund.id)) return;
    syncFundNav(fund.id).catch((error) => {
      console.warn(`静默同步净值失败 fund_id=${fund.id}: ${error.message}`);
    });
  });
}

export { getDefaultSyncStartDate };
