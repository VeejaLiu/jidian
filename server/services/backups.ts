import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { db } from "../db/database";
import { migrateAccounts, migrateAssetTypes, migrateDividendRecords, migrateStockPriceFields, migrateTradeAmountNullable, migrateTradeFees, migrateTradeRecordsForPendingStatus } from "../db/migrations";
import { BACKUP_DIR, SCHEMA_PATH } from "../config/paths";
import { toHttpError } from "../utils/httpError";

const CURRENT_BACKUP_VERSION = 2;
const MIN_SUPPORTED_BACKUP_VERSION = 1;
const EXPORT_TABLES = [
  "user_accounts",
  "funds",
  "user_funds",
  "strategy_settings",
  "nav_history",
  "nav_sync_state",
  "trade_records",
  "dividend_records",
  "buy_records",
  "app_metadata",
] as const;
const REQUIRED_TABLES = new Set<ExportTableName>(["user_accounts", "funds", "user_funds", "nav_history", "trade_records"]);

type ExportTableName = (typeof EXPORT_TABLES)[number];
type BackupDatabase = typeof db | Database.Database;

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
type BackupPreview = {
  version: number;
  exportedAt: string;
  compatible: boolean;
  meta: BackupPayload["meta"];
  summary: Record<ExportTableName, number>;
};

type TableColumn = {
  name: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

function listTableRows(database: BackupDatabase, tableName: ExportTableName) {
  return database.prepare(`SELECT * FROM ${tableName}`).all();
}

function ensureArray(value: unknown, tableName: string) {
  if (!Array.isArray(value)) {
    throw toHttpError(`备份文件格式无效：${tableName} 必须是数组`, 400);
  }
  return value;
}

function tableColumns(database: BackupDatabase, tableName: string) {
  return database.prepare(`PRAGMA table_info(${tableName})`).all() as TableColumn[];
}

function normalizeBackupForImport(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw toHttpError("备份文件格式无效", 400);
  }

  const input = payload as Partial<BackupPayload>;
  const version = Number(input.version);
  if (!Number.isInteger(version)) {
    throw toHttpError("备份文件缺少版本号", 400);
  }
  if (version < MIN_SUPPORTED_BACKUP_VERSION || version > CURRENT_BACKUP_VERSION) {
    throw toHttpError("备份文件版本不支持", 400);
  }
  if (!input.tables || typeof input.tables !== "object") {
    throw toHttpError("备份文件缺少 tables", 400);
  }

  const tables = {} as BackupPayload["tables"];
  EXPORT_TABLES.forEach((tableName) => {
    const rawTable = (input.tables as any)[tableName];
    if (rawTable === undefined && REQUIRED_TABLES.has(tableName)) {
      throw toHttpError(`备份文件缺少 ${tableName}`, 400);
    }
    tables[tableName] = ensureArray(rawTable ?? [], tableName) as any[];
  });

  return {
    version: CURRENT_BACKUP_VERSION,
    exportedAt: typeof input.exportedAt === "string" ? input.exportedAt : "",
    meta: input.meta || {
      accountCount: tables.user_accounts.length,
      assetCount: tables.user_funds.length,
      hiddenAssetCount: tables.user_funds.filter((row) => Number(row.is_active) === 0).length,
      tradeCount: tables.trade_records.length,
      priceHistoryCount: tables.nav_history.length,
    },
    tables,
  } satisfies BackupPayload;
}

export const __backupTestables = {
  normalizeBackupForImport,
};

function assertRestorableRows(database: BackupDatabase, tableName: string, rows: any[]) {
  const columns = tableColumns(database, tableName);
  const columnNames = new Set(columns.map((column) => column.name));
  rows.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw toHttpError(`备份文件格式无效：${tableName}[${index}] 必须是对象`, 400);
    }
    columns.forEach((column) => {
      const hasValue = Object.prototype.hasOwnProperty.call(item, column.name);
      const hasDefault = column.dflt_value !== null || column.pk > 0;
      if (!hasValue && column.notnull && !hasDefault) {
        throw toHttpError(`备份文件格式无效：${tableName}[${index}] 缺少 ${column.name}`, 400);
      }
    });
    Object.keys(item).forEach((key) => {
      if (!columnNames.has(key)) {
        throw toHttpError(`备份文件格式无效：${tableName}[${index}] 包含未知字段 ${key}`, 400);
      }
    });
  });
}

function insertRows(database: BackupDatabase, tableName: string, rows: any[]) {
  if (rows.length === 0) return;
  const columns = tableColumns(database, tableName);
  assertRestorableRows(database, tableName, rows);

  const insertMany = database.transaction((items: any[]) => {
    items.forEach((item) => {
      const names = columns
        .map((column) => column.name)
        .filter((column) => Object.prototype.hasOwnProperty.call(item, column));
      const placeholders = names.map((column) => `@${column}`).join(", ");
      const sql = `INSERT INTO ${tableName} (${names.join(", ")}) VALUES (${placeholders})`;
      const statement = database.prepare(sql);
      const record = Object.fromEntries(names.map((column) => [column, item[column]]));
      statement.run(record);
    });
  });
  insertMany(rows);
}

export function exportBackup() {
  const tables = Object.fromEntries(
    EXPORT_TABLES.map((tableName) => [tableName, listTableRows(db, tableName)]),
  ) as BackupPayload["tables"];
  const exportedAt = new Date().toISOString();

  return {
    version: CURRENT_BACKUP_VERSION,
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

function buildPreview(backup: BackupPayload): BackupPreview {
  return {
    version: backup.version,
    exportedAt: backup.exportedAt,
    compatible: true,
    meta: {
      accountCount: backup.tables.user_accounts.length,
      assetCount: backup.tables.user_funds.length,
      hiddenAssetCount: backup.tables.user_funds.filter((row) => Number(row.is_active) === 0).length,
      tradeCount: backup.tables.trade_records.length,
      priceHistoryCount: backup.tables.nav_history.length,
    },
    summary: Object.fromEntries(EXPORT_TABLES.map((tableName) => [tableName, backup.tables[tableName].length])) as Record<ExportTableName, number>,
  };
}

export function previewImportBackup(payload: unknown) {
  const backup = normalizeBackupForImport(payload);
  validateRestorableBackup(backup);
  return buildPreview(backup);
}

function restoreTables(database: BackupDatabase, tables: BackupPayload["tables"]) {
  const restore = database.transaction(() => {
    database.exec(`
      DELETE FROM trade_records;
      DELETE FROM dividend_records;
      DELETE FROM buy_records;
      DELETE FROM nav_sync_state;
      DELETE FROM nav_history;
      DELETE FROM strategy_settings;
      DELETE FROM user_funds;
      DELETE FROM funds;
      DELETE FROM user_accounts;
      DELETE FROM app_metadata;
    `);

    insertRows(database, "user_accounts", tables.user_accounts);
    insertRows(database, "funds", tables.funds);
    insertRows(database, "user_funds", tables.user_funds);
    insertRows(database, "strategy_settings", tables.strategy_settings);
    insertRows(database, "nav_history", tables.nav_history);
    insertRows(database, "nav_sync_state", tables.nav_sync_state);
    insertRows(database, "dividend_records", tables.dividend_records);
    insertRows(database, "buy_records", tables.buy_records);
    insertRows(database, "trade_records", tables.trade_records);
    insertRows(database, "app_metadata", tables.app_metadata);
  });

  restore();
}

function validateRestorableBackup(backup: BackupPayload) {
  const validationDb = new Database(":memory:");
  try {
    validationDb.pragma("foreign_keys = ON");
    validationDb.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
    restoreTables(validationDb, backup.tables);
    const foreignKeyIssues = validationDb.prepare("PRAGMA foreign_key_check").all();
    if (foreignKeyIssues.length) {
      throw toHttpError("备份文件校验失败：存在无效的数据关联", 400);
    }
    const integrity = validationDb.prepare("PRAGMA integrity_check").get() as { integrity_check?: string };
    if (integrity.integrity_check !== "ok") {
      throw toHttpError("备份文件校验失败：数据结构不完整", 400);
    }
  } finally {
    validationDb.close();
  }
}

function writePreImportBackup() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(BACKUP_DIR, `pre-import-${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(exportBackup(), null, 2), "utf8");
  return filePath;
}

export function importBackup(payload: unknown) {
  const backup = normalizeBackupForImport(payload);
  validateRestorableBackup(backup);
  const preImportBackupPath = writePreImportBackup();

  restoreTables(db, backup.tables);
  migrateAccounts();
  migrateAssetTypes();
  migrateTradeRecordsForPendingStatus();
  migrateTradeFees();
  migrateTradeAmountNullable();
  migrateStockPriceFields();
  migrateDividendRecords();

  return {
    ok: true,
    importedAt: new Date().toISOString(),
    preImportBackupPath,
    summary: Object.fromEntries(EXPORT_TABLES.map((tableName) => [tableName, backup.tables[tableName].length])),
  };
}
