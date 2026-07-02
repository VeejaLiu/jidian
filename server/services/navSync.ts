import { db } from "../db/database";
import { addDaysISO, todayISO } from "../utils/date";
import { toHttpError } from "../utils/httpError";
import { logInfo, logWarn } from "../utils/logger";
import { getFundById } from "./funds";
import { fetchNavHistory, fetchStockPriceHistory, type PriceHistoryFetchResult } from "./eastmoney";
import { assertTradeTimeline, calculateFundTradeAmount, calculateFundTradeShares } from "./trades";
import { getSyncDecision, navSyncJobs, navSyncTouchedAt } from "./syncState";

const BACKGROUND_SYNC_CHECK_INTERVAL_MS = Number(process.env.BACKGROUND_SYNC_CHECK_INTERVAL_MS || 30 * 60 * 1000);
let backgroundSyncTimer: NodeJS.Timeout | null = null;

type SyncSource = "background" | "manual" | "add-fund" | "system";
type SyncOptions = {
  startDate?: string;
  endDate?: string;
  fullHistory?: boolean;
  source?: SyncSource;
};

function logNavSync(message: string, details: Record<string, unknown> = {}) {
  const extra = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  logInfo(`[nav-sync] ${new Date().toISOString()} ${message}${extra ? ` ${extra}` : ""}`);
}

function formatLocalTime(timestamp: number | null) {
  if (!timestamp) return "现在";
  return new Date(timestamp).toLocaleString("zh-CN", { hour12: false });
}

function formatDuration(ms: number) {
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `${hours}小时${restMinutes}分钟` : `${hours}小时`;
}

function getDefaultSyncStartDate(fundId: number, options: { includeLatestDay?: boolean } = {}) {
  const syncState = db
    .prepare("SELECT full_history_synced FROM nav_sync_state WHERE fund_id = ?")
    .get(fundId) as { full_history_synced?: number } | undefined;
  if (!syncState?.full_history_synced) return "";

  const latest = db
    .prepare("SELECT nav_date FROM nav_history WHERE fund_id = ? ORDER BY nav_date DESC LIMIT 1")
    .get(fundId) as { nav_date?: string } | undefined;

  if (latest?.nav_date) {
    if (options.includeLatestDay) {
      return latest.nav_date;
    }
    return addDaysISO(latest.nav_date, 1);
  }

  return "";
}

const upsertNav = db.prepare(
  `INSERT INTO nav_history (
     fund_id,
     nav_date,
     unit_nav,
     open_price,
     close_price,
     high_price,
     low_price,
     accumulated_nav,
     source
   )
   VALUES (
     @fundId,
     @date,
     @nav,
     @openPrice,
     @closePrice,
     @highPrice,
     @lowPrice,
     @accumulatedNav,
     'eastmoney'
   )
   ON CONFLICT(fund_id, nav_date) DO UPDATE SET
     unit_nav = excluded.unit_nav,
     open_price = excluded.open_price,
     close_price = excluded.close_price,
     high_price = excluded.high_price,
     low_price = excluded.low_price,
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
       , fee
       , shares
       , account_id AS accountId
       FROM trade_records
       WHERE fund_id = ?
         AND status = 'pending'`,
    )
    .all(fundId) as Array<{ id: number; accountId: number; type: "buy" | "sell"; date: string; amount: number | null; fee: number; shares: number | null }>;

  const navForDate = db.prepare(
    "SELECT unit_nav FROM nav_history WHERE fund_id = ? AND nav_date = ?",
  );
  const confirmTrade = db.prepare(
    `UPDATE trade_records
     SET trade_nav = ?,
         amount = ?,
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

    const fee = Number(trade.fee || 0);
    const amount = trade.amount == null ? null : Number(trade.amount);
    const shares = trade.shares == null ? null : Number(trade.shares);
    const confirmedShares = trade.type === "buy"
      ? calculateFundTradeShares("buy", Number(amount), fee, nav)
      : (Number.isFinite(shares) && Number(shares) > 0 ? shares : null);
    const confirmedAmount = trade.type === "buy"
      ? amount
      : (confirmedShares == null ? null : calculateFundTradeAmount("sell", confirmedShares, fee, nav));
    if (!Number.isFinite(Number(confirmedShares)) || Number(confirmedShares) <= 0 || !Number.isFinite(Number(confirmedAmount)) || Number(confirmedAmount) <= 0) return;
    try {
      assertTradeTimeline(
        fundId,
        trade.accountId,
        {
          id: trade.id,
          type: trade.type,
          date: trade.date,
          nav,
          amount: Number(confirmedAmount),
          shares: Number(confirmedShares),
          status: "confirmed",
        },
        trade.id,
      );
    } catch (error) {
      logWarn(`待确认交易无法自动确认 trade_id=${trade.id}: ${(error as Error).message}`);
      return;
    }

    confirmTrade.run(nav, Number(confirmedAmount), Number(confirmedShares), confirmedAt, trade.id);
    confirmed += 1;
  });

  return confirmed;
}

export async function syncFundNav(fundId: number, options: SyncOptions = {}) {
  const source = options.source || "system";
  if (navSyncJobs.has(fundId)) {
    logNavSync("跳过价格同步：已有任务运行中", { fundId, source });
    return { imported: 0, skipped: true, reason: "syncing" };
  }

  const fund = getFundById(fundId);
  if (!fund) throw toHttpError("资产不存在", 404);
  if (!fund.code) throw toHttpError(fund?.asset_type === "stock" ? "请先填写股票代码" : "请先填写基金代码", 400);
  const isStock = fund.asset_type === "stock";

  const startDate = options.fullHistory
    ? ""
    : options.startDate ?? getDefaultSyncStartDate(fundId, { includeLatestDay: isStock && source === "manual" });
  const endDate = options.endDate || "";

  if (isStock && source === "manual") {
    logNavSync("股票手动同步将包含最新交易日", {
      fundId,
      code: fund.code,
      computedStartDate: startDate || "成立以来",
    });
  }

  if (startDate > todayISO()) {
    const checkedAt = new Date().toISOString();
    navSyncTouchedAt.set(fundId, Date.now());
    upsertNavSyncState.run({
      fundId,
      fullHistorySynced: 0,
      fullHistorySyncedAt: null,
      lastIncrementalSyncAt: checkedAt,
    });
    const decision = getSyncDecision(fundId);
    logNavSync("跳过价格同步：已是最新", {
      fundId,
      code: fund.code,
      name: fund.name,
      assetType: fund.asset_type,
      source,
      startDate,
      nextSyncAt: formatLocalTime(decision.nextSyncAt),
      interval: formatDuration(decision.interval),
    });
    return { imported: 0, startDate, endDate: endDate || null, skipped: true, reason: "up-to-date" };
  }

  navSyncJobs.add(fundId);
  const mode = startDate ? "incremental" : "full";
  const startedAt = Date.now();
  logNavSync("开始价格同步", {
    fundId,
    code: fund.code,
    name: fund.name,
    assetType: fund.asset_type,
    source,
    mode,
    startDate: startDate || "成立以来",
    endDate: endDate || "最新",
  });

  try {
    const result: PriceHistoryFetchResult = isStock
      ? await fetchStockPriceHistory(fund.code, startDate, endDate)
      : await fetchNavHistory(fund.code, startDate, endDate);

    if (isStock) {
      logNavSync("股票同步返回名称信息", {
        fundId,
        code: fund.code,
        currentName: fund.name,
        returnedName: result.assetName || "(empty)",
      });
    }

    if (isStock && result.assetName && result.assetName !== fund.name && result.assetName !== fund.code) {
      const updateResult = db.prepare("UPDATE funds SET name = ? WHERE id = ?").run(result.assetName, fundId);
      const updatedFund = db.prepare("SELECT name FROM funds WHERE id = ?").get(fundId) as { name?: string } | undefined;
      logNavSync("股票名称已更新", {
        fundId,
        code: fund.code,
        previousName: fund.name,
        nextName: result.assetName,
        changes: updateResult.changes,
        savedName: updatedFund?.name || "(unknown)",
      });
    } else if (isStock) {
      logNavSync("股票名称未更新", {
        fundId,
        code: fund.code,
        currentName: fund.name,
        returnedName: result.assetName || "(empty)",
        reason: !result.assetName
          ? "missing-returned-name"
          : result.assetName === fund.name
            ? "same-as-current-name"
            : result.assetName === fund.code
              ? "returned-name-equals-code"
              : "condition-not-met",
      });
    }

    const transaction = db.transaction((rows: typeof result.rows) => {
      rows.forEach((row) => {
        upsertNav.run({
          fundId,
          date: row.date,
          nav: row.nav,
          openPrice: row.openPrice ?? null,
          closePrice: row.closePrice ?? row.nav,
          highPrice: row.highPrice ?? null,
          lowPrice: row.lowPrice ?? null,
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
    const decision = getSyncDecision(fundId);

    logNavSync("完成价格同步", {
      fundId,
      code: fund.code,
      name: fund.name,
      assetType: fund.asset_type,
      source,
      mode,
      imported: result.rows.length,
      sourceRecords: result.sourceRecords,
      fetchedPages: result.fetchedPages,
      confirmedTrades,
      durationMs: Date.now() - startedAt,
      nextSyncAt: formatLocalTime(decision.nextSyncAt),
      interval: formatDuration(decision.interval),
    });

    return {
      imported: result.rows.length,
      mode,
      startDate,
      endDate: endDate || null,
      sourceRecords: result.sourceRecords,
      sourcePages: result.sourcePages,
      fetchedPages: result.fetchedPages,
      confirmedTrades,
    };
  } catch (error) {
    logNavSync("价格同步失败", {
      fundId,
      code: fund.code,
      name: fund.name,
      assetType: fund.asset_type,
      source,
      mode,
      durationMs: Date.now() - startedAt,
      error: (error as Error).message,
    });
    throw error;
  } finally {
    navSyncJobs.delete(fundId);
  }
}

export async function syncAssetPrice(fundId: number, options: SyncOptions = {}) {
  return syncFundNav(fundId, options);
}

export function syncActiveFundsInBackground() {
  const funds = db
    .prepare(
      `SELECT DISTINCT f.id, f.code, f.name, f.asset_type
       FROM funds f
       JOIN user_funds uf ON uf.fund_id = f.id
       WHERE uf.is_active = 1
         AND f.code IS NOT NULL
         AND f.code != ''`,
    )
    .all() as Array<{ id: number; code: string; name: string; asset_type: string }>;

  logNavSync("触发静默价格检查", { activeFunds: funds.length });

  funds.forEach((fund) => {
    const decision = getSyncDecision(fund.id);
    if (decision.skip) {
      logNavSync("跳过静默价格同步", {
        fundId: fund.id,
        code: fund.code,
        name: fund.name,
        assetType: fund.asset_type,
        reason: decision.reason,
        pendingTrade: decision.hasPendingTrade ? "yes" : "no",
        nextSyncAt: formatLocalTime(decision.nextSyncAt),
        remaining: decision.remainingMs > 0 ? formatDuration(decision.remainingMs) : null,
        interval: formatDuration(decision.interval),
      });
      return;
    }

    logNavSync("排队静默价格同步", {
      fundId: fund.id,
      code: fund.code,
      name: fund.name,
      assetType: fund.asset_type,
      pendingTrade: decision.hasPendingTrade ? "yes" : "no",
      interval: formatDuration(decision.interval),
    });

    syncAssetPrice(fund.id, { source: "background" }).catch((error) => {
      logWarn(`静默同步价格失败 fund_id=${fund.id}: ${error.message}`);
    });
  });
}

export function startBackgroundSyncScheduler() {
  if (backgroundSyncTimer) return;

  logNavSync("启动后台价格检查调度", { interval: formatDuration(BACKGROUND_SYNC_CHECK_INTERVAL_MS) });
  syncActiveFundsInBackground();
  backgroundSyncTimer = setInterval(syncActiveFundsInBackground, BACKGROUND_SYNC_CHECK_INTERVAL_MS);
  backgroundSyncTimer.unref?.();
}

export { getDefaultSyncStartDate };
