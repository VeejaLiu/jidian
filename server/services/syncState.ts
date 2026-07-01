import { db } from "../db/database";

export const navSyncJobs = new Set<number>();
export const navSyncTouchedAt = new Map<number, number>();

export const NAV_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const PENDING_TRADE_SYNC_INTERVAL_MS = 5 * 60 * 1000;

export function getSyncDecision(fundId: number) {
  const lastTouchedAt = navSyncTouchedAt.get(fundId) || 0;
  const pendingTrade = db
    .prepare("SELECT 1 FROM trade_records WHERE fund_id = ? AND status = 'pending' LIMIT 1")
    .get(fundId);
  const interval = pendingTrade ? PENDING_TRADE_SYNC_INTERVAL_MS : NAV_SYNC_INTERVAL_MS;
  const nextSyncAt = lastTouchedAt ? lastTouchedAt + interval : null;
  const remainingMs = nextSyncAt ? Math.max(0, nextSyncAt - Date.now()) : 0;
  const isRunning = navSyncJobs.has(fundId);

  if (isRunning) {
    return {
      skip: true,
      reason: "syncing",
      hasPendingTrade: Boolean(pendingTrade),
      interval,
      lastTouchedAt,
      nextSyncAt,
      remainingMs,
    };
  }

  if (remainingMs > 0) {
    return {
      skip: true,
      reason: "throttled",
      hasPendingTrade: Boolean(pendingTrade),
      interval,
      lastTouchedAt,
      nextSyncAt,
      remainingMs,
    };
  }

  return {
    skip: false,
    reason: "ready",
    hasPendingTrade: Boolean(pendingTrade),
    interval,
    lastTouchedAt,
    nextSyncAt,
    remainingMs,
  };
}
