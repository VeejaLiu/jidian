import { db } from "./database";

function columnNames(tableName: string) {
  return (db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map((column) => column.name);
}

function tableExists(tableName: string) {
  return Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName),
  );
}

function hasMigrationFlag(key: string) {
  const row = db
    .prepare("SELECT value FROM app_metadata WHERE key = ?")
    .get(key) as { value?: string } | undefined;
  return row?.value === "1";
}

function setMigrationFlag(key: string) {
  db.prepare(
    `INSERT INTO app_metadata (key, value)
     VALUES (?, '1')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  ).run(key);
}

function defaultAccountId() {
  const row = db
    .prepare("SELECT id FROM user_accounts ORDER BY id LIMIT 1")
    .get() as { id: number } | undefined;
  if (row?.id) return row.id;

  const result = db.prepare("INSERT INTO user_accounts (name) VALUES (?)").run("默认账户");
  return Number(result.lastInsertRowid);
}

export function migrateAccounts() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TRIGGER IF NOT EXISTS trg_user_accounts_updated_at
    AFTER UPDATE ON user_accounts
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE user_accounts SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

    CREATE TABLE IF NOT EXISTS user_funds (
      account_id INTEGER NOT NULL,
      fund_id INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      drop_rate REAL NOT NULL DEFAULT 0.04 CHECK (drop_rate > 0 AND drop_rate < 1),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (account_id, fund_id),
      FOREIGN KEY (account_id) REFERENCES user_accounts (id) ON DELETE CASCADE,
      FOREIGN KEY (fund_id) REFERENCES funds (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_funds_account_active
      ON user_funds (account_id, is_active);

    CREATE TRIGGER IF NOT EXISTS trg_user_funds_updated_at
    AFTER UPDATE ON user_funds
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE user_funds SET updated_at = datetime('now') WHERE account_id = NEW.account_id AND fund_id = NEW.fund_id;
    END;
  `);

  const accountId = defaultAccountId();
  const hadUserFundsBeforeMigration = (db
    .prepare("SELECT COUNT(*) AS total FROM user_funds")
    .get() as { total: number }).total > 0;

  const userFundColumns = columnNames("user_funds");
  if (!userFundColumns.includes("drop_rate")) {
    db.exec("ALTER TABLE user_funds ADD COLUMN drop_rate REAL NOT NULL DEFAULT 0.04 CHECK (drop_rate > 0 AND drop_rate < 1);");
    db.exec(`
      UPDATE user_funds
      SET drop_rate = COALESCE(
        (SELECT drop_rate FROM strategy_settings WHERE strategy_settings.fund_id = user_funds.fund_id),
        0.04
      )
    `);
  }

  const tradeColumns = tableExists("trade_records") ? columnNames("trade_records") : [];
  if (tradeColumns.length && !tradeColumns.includes("account_id")) {
    db.exec("ALTER TABLE trade_records ADD COLUMN account_id INTEGER NOT NULL DEFAULT 1;");
    db.prepare("UPDATE trade_records SET account_id = ? WHERE account_id = 1").run(accountId);
  }

  const buyColumns = tableExists("buy_records") ? columnNames("buy_records") : [];
  if (buyColumns.length && !buyColumns.includes("account_id")) {
    db.exec("ALTER TABLE buy_records ADD COLUMN account_id INTEGER NOT NULL DEFAULT 1;");
    db.prepare("UPDATE buy_records SET account_id = ? WHERE account_id = 1").run(accountId);
  }

  if (!hadUserFundsBeforeMigration && !hasMigrationFlag("legacy_funds_bound_to_default_account")) {
    db.prepare(
      `INSERT OR IGNORE INTO user_funds (account_id, fund_id, is_active)
       SELECT ?, id, is_active FROM funds`,
    ).run(accountId);
    setMigrationFlag("legacy_funds_bound_to_default_account");
  }

  if (!hasMigrationFlag("default_account_orphan_fund_links_repaired")) {
    db.prepare(
      `DELETE FROM user_funds
       WHERE account_id = ?
         AND NOT EXISTS (
           SELECT 1
           FROM trade_records tr
           WHERE tr.account_id = user_funds.account_id
             AND tr.fund_id = user_funds.fund_id
         )
         AND EXISTS (
           SELECT 1
           FROM trade_records tr
           WHERE tr.account_id != user_funds.account_id
             AND tr.fund_id = user_funds.fund_id
         )
         AND EXISTS (
           SELECT 1
           FROM user_funds owner_uf
           WHERE owner_uf.account_id != user_funds.account_id
             AND owner_uf.fund_id = user_funds.fund_id
             AND owner_uf.created_at < user_funds.created_at
         )`,
    ).run(accountId);
    setMigrationFlag("default_account_orphan_fund_links_repaired");
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trade_records_fund_date
      ON trade_records (account_id, fund_id, trade_date DESC, id DESC);
  `);
}

export function migrateAssetTypes() {
  const fundColumns = columnNames("funds");
  if (!fundColumns.includes("asset_type")) {
    db.exec("ALTER TABLE funds ADD COLUMN asset_type TEXT NOT NULL DEFAULT 'fund' CHECK (asset_type IN ('fund', 'stock'));");
  }
}

export function migrateTradeFees() {
  const tradeColumns = tableExists("trade_records") ? columnNames("trade_records") : [];
  if (tradeColumns.length && !tradeColumns.includes("fee")) {
    db.exec("ALTER TABLE trade_records ADD COLUMN fee REAL NOT NULL DEFAULT 0 CHECK (fee >= 0);");
  }
}

export function migrateStockPriceFields() {
  const navColumns = tableExists("nav_history") ? columnNames("nav_history") : [];
  if (navColumns.length && !navColumns.includes("open_price")) {
    db.exec("ALTER TABLE nav_history ADD COLUMN open_price REAL CHECK (open_price IS NULL OR open_price > 0);");
  }
  if (navColumns.length && !navColumns.includes("close_price")) {
    db.exec("ALTER TABLE nav_history ADD COLUMN close_price REAL CHECK (close_price IS NULL OR close_price > 0);");
  }
  if (navColumns.length && !navColumns.includes("high_price")) {
    db.exec("ALTER TABLE nav_history ADD COLUMN high_price REAL CHECK (high_price IS NULL OR high_price > 0);");
  }
  if (navColumns.length && !navColumns.includes("low_price")) {
    db.exec("ALTER TABLE nav_history ADD COLUMN low_price REAL CHECK (low_price IS NULL OR low_price > 0);");
  }
}

export function migrateTradeRecordsForPendingStatus() {
  db.exec(`
    DROP VIEW IF EXISTS fund_trigger_status;
    DROP VIEW IF EXISTS latest_buy;
  `);

  if (tableExists("trade_records_new")) {
    const currentColumns = tableExists("trade_records") ? columnNames("trade_records") : [];
    if (!tableExists("trade_records") || !currentColumns.includes("status")) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE IF EXISTS trade_records;
        ALTER TABLE trade_records_new RENAME TO trade_records;
        PRAGMA foreign_keys = ON;
      `);
    } else {
      db.exec(`
        INSERT OR IGNORE INTO trade_records (
          id,
          account_id,
          fund_id,
          trade_type,
          trade_date,
          trade_nav,
          amount,
          shares,
          status,
          note,
          source_buy_id,
          confirmed_at,
          created_at
        )
        SELECT
          id,
          COALESCE(account_id, 1),
          fund_id,
          trade_type,
          trade_date,
          trade_nav,
          amount,
          shares,
          status,
          note,
          source_buy_id,
          confirmed_at,
          created_at
        FROM trade_records_new;

        DROP TABLE trade_records_new;
      `);
    }
  }

  const columns = columnNames("trade_records");
  if (!columns.includes("status") || !columns.includes("confirmed_at") || !columns.includes("fee")) {
    const feeSelect = columns.includes("fee") ? "COALESCE(fee, 0)" : "0";
    const statusSelect = columns.includes("status") ? "COALESCE(status, 'confirmed')" : "'confirmed'";
    const confirmedAtSelect = columns.includes("confirmed_at") ? "COALESCE(confirmed_at, created_at)" : "created_at";

    db.exec(`
      PRAGMA foreign_keys = OFF;

      DROP TABLE IF EXISTS trade_records_new;

      CREATE TABLE IF NOT EXISTS trade_records_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL DEFAULT 1,
        fund_id INTEGER NOT NULL,
        trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
        trade_date TEXT NOT NULL CHECK (date(trade_date) = trade_date),
        trade_nav REAL CHECK (trade_nav IS NULL OR trade_nav > 0),
        amount REAL NOT NULL CHECK (amount > 0),
        fee REAL NOT NULL DEFAULT 0 CHECK (fee >= 0),
        shares REAL CHECK (shares IS NULL OR shares > 0),
        status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed')),
        note TEXT,
        source_buy_id INTEGER,
        confirmed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES user_accounts (id) ON DELETE CASCADE,
        FOREIGN KEY (fund_id) REFERENCES funds (id) ON DELETE CASCADE
      );

      INSERT INTO trade_records_new (
        id,
        account_id,
        fund_id,
        trade_type,
        trade_date,
        trade_nav,
        amount,
        fee,
        shares,
        status,
        note,
        source_buy_id,
        confirmed_at,
        created_at
      )
      SELECT
        id,
        COALESCE(account_id, 1),
        fund_id,
        trade_type,
        trade_date,
        trade_nav,
        amount,
        ${feeSelect},
        shares,
        ${statusSelect},
        note,
        source_buy_id,
        ${confirmedAtSelect},
        created_at
      FROM trade_records;

      DROP TABLE trade_records;
      ALTER TABLE trade_records_new RENAME TO trade_records;

      CREATE INDEX IF NOT EXISTS idx_trade_records_fund_date
        ON trade_records (account_id, fund_id, trade_date DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_trade_records_source_buy
        ON trade_records (source_buy_id)
        WHERE source_buy_id IS NOT NULL;

      PRAGMA foreign_keys = ON;
    `);
  }

  db.exec(`
	    INSERT INTO trade_records (
	      account_id,
	      fund_id,
      trade_type,
      trade_date,
      trade_nav,
      amount,
      shares,
      status,
      note,
      source_buy_id,
      confirmed_at,
      created_at
    )
	    SELECT
	      br.account_id,
	      br.fund_id,
      'buy',
      br.buy_date,
      br.buy_nav,
      COALESCE(br.amount, br.buy_nav * br.shares),
      br.shares,
      'confirmed',
      br.note,
      br.id,
      br.created_at,
      br.created_at
    FROM buy_records br
    WHERE br.shares IS NOT NULL
      AND COALESCE(br.amount, br.buy_nav * br.shares) > 0
      AND NOT EXISTS (
        SELECT 1
	        FROM trade_records tr
	        WHERE tr.trade_type = 'buy'
	          AND tr.source_buy_id = br.id
	          AND tr.account_id = br.account_id
	      );

    DROP VIEW IF EXISTS fund_trigger_status;
    DROP VIEW IF EXISTS latest_buy;

    CREATE VIEW latest_buy AS
    SELECT
      tr.id,
      tr.account_id,
      tr.fund_id,
      tr.trade_date AS buy_date,
      tr.trade_nav AS buy_nav,
      tr.amount,
      tr.shares,
      tr.note,
      tr.created_at
    FROM trade_records tr
    WHERE NOT EXISTS (
      SELECT 1
      FROM trade_records newer
      WHERE newer.account_id = tr.account_id
        AND newer.fund_id = tr.fund_id
        AND newer.trade_type = 'buy'
        AND newer.status = 'confirmed'
        AND (
          newer.trade_date > tr.trade_date
          OR (newer.trade_date = tr.trade_date AND newer.id > tr.id)
        )
    )
      AND tr.trade_type = 'buy'
      AND tr.status = 'confirmed';

    CREATE VIEW fund_trigger_status AS
    SELECT
      uf.account_id,
      f.id AS fund_id,
      f.code,
      f.name,
      COALESCE(uf.drop_rate, ss.drop_rate, 0.04) AS drop_rate,
      lb.buy_date AS last_buy_date,
      lb.buy_nav AS last_buy_nav,
      ln.nav_date AS latest_nav_date,
      ln.unit_nav AS latest_nav,
      ROUND(lb.buy_nav * (1 - COALESCE(uf.drop_rate, ss.drop_rate, 0.04)), 6) AS trigger_nav,
      CASE
        WHEN lb.buy_nav IS NULL OR ln.unit_nav IS NULL THEN NULL
        WHEN lb.buy_nav * (1 - COALESCE(uf.drop_rate, ss.drop_rate, 0.04)) >= ln.unit_nav THEN 0
        ELSE ROUND(
          (1 - (lb.buy_nav * (1 - COALESCE(uf.drop_rate, ss.drop_rate, 0.04)) / ln.unit_nav)) * 100,
          4
        )
      END AS required_drop_percent,
      CASE
        WHEN lb.buy_nav IS NULL THEN 'missing_buy'
        WHEN ln.unit_nav IS NULL THEN 'missing_nav'
        WHEN lb.buy_nav * (1 - COALESCE(uf.drop_rate, ss.drop_rate, 0.04)) >= ln.unit_nav THEN 'triggered'
        ELSE 'waiting'
      END AS status
    FROM funds f
    JOIN user_funds uf ON uf.fund_id = f.id
    LEFT JOIN strategy_settings ss ON ss.fund_id = f.id
    LEFT JOIN latest_buy lb ON lb.account_id = uf.account_id AND lb.fund_id = f.id
    LEFT JOIN latest_nav ln ON ln.fund_id = f.id
    WHERE uf.is_active = 1;
  `);
}
