import { db } from "../db/database";
import { migrateAccounts, migrateAssetTypes, migrateStockPriceFields, migrateTradeFees, migrateTradeRecordsForPendingStatus } from "../db/migrations";
import { toHttpError } from "../utils/httpError";

const BACKUP_VERSION = 1;
const EXPORT_TABLES = [
  "user_accounts",
  "funds",
  "user_funds",
  "strategy_settings",
  "nav_history",
  "nav_sync_state",
  "trade_records",
  "buy_records",
  "app_metadata",
] as const;

type ExportTableName = (typeof EXPORT_TABLES)[number];

type BackupPayload = {
  version: number;
  exportedAt: string;
  meta: {
    accountCount: number;
    assetCount: number;
    hiddenAssetCount: number;
    tradeCount: number;
    priceHistoryCount: number;
  };
  tables: Record<ExportTableName, any[]>;
};

function listTableRows(tableName: ExportTableName) {
  return db.prepare(`SELECT * FROM ${tableName}`).all();
}

function ensureArray(value: unknown, tableName: string) {
  if (!Array.isArray(value)) {
    throw toHttpError(`备份文件格式无效：${tableName} 必须是数组`, 400);
  }
  return value;
}

function tableColumns(tableName: string) {
  return (db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>)
    .map((column) => column.name);
}

function insertRows(tableName: string, rows: any[]) {
  if (rows.length === 0) return;
  const columns = tableColumns(tableName);
  const placeholders = columns.map((column) => `@${column}`).join(", ");
  const sql = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
  const statement = db.prepare(sql);
  const insertMany = db.transaction((items: any[]) => {
    items.forEach((item) => {
      const record: Record<string, unknown> = {};
      columns.forEach((column) => {
        record[column] = Object.prototype.hasOwnProperty.call(item, column) ? item[column] : null;
      });
      statement.run(record);
    });
  });
  insertMany(rows);
}

export function exportBackup() {
  const tables = Object.fromEntries(
    EXPORT_TABLES.map((tableName) => [tableName, listTableRows(tableName)]),
  ) as BackupPayload["tables"];
  const exportedAt = new Date().toISOString();

  return {
    version: BACKUP_VERSION,
    exportedAt,
    meta: {
      accountCount: tables.user_accounts.length,
      assetCount: tables.user_funds.length,
      hiddenAssetCount: tables.user_funds.filter((row) => Number(row.is_active) === 0).length,
      tradeCount: tables.trade_records.length,
      priceHistoryCount: tables.nav_history.length,
    },
    tables,
  } satisfies BackupPayload;
}

export function importBackup(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw toHttpError("备份文件格式无效", 400);
  }

  const backup = payload as Partial<BackupPayload>;
  if (backup.version !== BACKUP_VERSION) {
    throw toHttpError("备份文件版本不支持", 400);
  }
  if (!backup.tables || typeof backup.tables !== "object") {
    throw toHttpError("备份文件缺少 tables", 400);
  }

  const tables = {} as BackupPayload["tables"];
  EXPORT_TABLES.forEach((tableName) => {
    tables[tableName] = ensureArray((backup.tables as any)[tableName], tableName) as any[];
  });

  const restore = db.transaction(() => {
    db.pragma("foreign_keys = OFF");

    db.exec(`
      DELETE FROM trade_records;
      DELETE FROM buy_records;
      DELETE FROM nav_sync_state;
      DELETE FROM nav_history;
      DELETE FROM strategy_settings;
      DELETE FROM user_funds;
      DELETE FROM funds;
      DELETE FROM user_accounts;
      DELETE FROM app_metadata;
    `);

    insertRows("user_accounts", tables.user_accounts);
    insertRows("funds", tables.funds);
    insertRows("user_funds", tables.user_funds);
    insertRows("strategy_settings", tables.strategy_settings);
    insertRows("nav_history", tables.nav_history);
    insertRows("nav_sync_state", tables.nav_sync_state);
    insertRows("buy_records", tables.buy_records);
    insertRows("trade_records", tables.trade_records);
    insertRows("app_metadata", tables.app_metadata);

    db.pragma("foreign_keys = ON");
  });

  restore();
  migrateAccounts();
  migrateAssetTypes();
  migrateTradeRecordsForPendingStatus();
  migrateTradeFees();
  migrateStockPriceFields();

  return {
    ok: true,
    importedAt: new Date().toISOString(),
    summary: Object.fromEntries(EXPORT_TABLES.map((tableName) => [tableName, tables[tableName].length])),
  };
}
