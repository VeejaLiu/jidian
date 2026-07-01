import test from "node:test";
import assert from "node:assert/strict";
import { __backupTestables } from "../server/services/backups";

const minimalTables = {
  user_accounts: [],
  funds: [],
  user_funds: [],
  strategy_settings: [],
  nav_history: [],
  nav_sync_state: [],
  trade_records: [],
  buy_records: [],
  app_metadata: [],
};

test("normalizeBackupForImport accepts version 1 backups and fills optional tables", () => {
  const backup = __backupTestables.normalizeBackupForImport({
    version: 1,
    exportedAt: "2026-07-01T00:00:00.000Z",
    tables: {
      user_accounts: [],
      funds: [],
      user_funds: [],
      nav_history: [],
      trade_records: [],
    },
  });

  assert.equal(backup.version, 2);
  assert.deepEqual(backup.tables.buy_records, []);
  assert.deepEqual(backup.tables.dividend_records, []);
  assert.deepEqual(backup.tables.nav_sync_state, []);
});

test("normalizeBackupForImport rejects missing required tables", () => {
  assert.throws(
    () => __backupTestables.normalizeBackupForImport({ version: 2, tables: { ...minimalTables, trade_records: undefined } }),
    /缺少 trade_records/,
  );
});

test("normalizeBackupForImport rejects future backup versions", () => {
  assert.throws(
    () => __backupTestables.normalizeBackupForImport({ version: 99, tables: minimalTables }),
    /版本不支持/,
  );
});
