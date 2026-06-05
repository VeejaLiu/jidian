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
  if (!columns.includes("status") || !columns.includes("confirmed_at")) {
    db.exec(`
      PRAGMA foreign_keys = OFF;

      DROP TABLE IF EXISTS trade_records_new;

      CREATE TABLE IF NOT EXISTS trade_records_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fund_id INTEGER NOT NULL,
        trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
        trade_date TEXT NOT NULL CHECK (date(trade_date) = trade_date),
        trade_nav REAL CHECK (trade_nav IS NULL OR trade_nav > 0),
        amount REAL NOT NULL CHECK (amount > 0),
        shares REAL CHECK (shares IS NULL OR shares > 0),
        status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed')),
        note TEXT,
        source_buy_id INTEGER,
        confirmed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (fund_id) REFERENCES funds (id) ON DELETE CASCADE
      );

      INSERT INTO trade_records_new (
        id,
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
        fund_id,
        trade_type,
        trade_date,
        trade_nav,
        amount,
        shares,
        'confirmed',
        note,
        source_buy_id,
        created_at,
        created_at
      FROM trade_records;

      DROP TABLE trade_records;
      ALTER TABLE trade_records_new RENAME TO trade_records;

      CREATE INDEX IF NOT EXISTS idx_trade_records_fund_date
        ON trade_records (fund_id, trade_date DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_trade_records_source_buy
        ON trade_records (source_buy_id)
        WHERE source_buy_id IS NOT NULL;

      PRAGMA foreign_keys = ON;
    `);
  }

  db.exec(`
    INSERT INTO trade_records (
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
      );

    DROP VIEW IF EXISTS fund_trigger_status;
    DROP VIEW IF EXISTS latest_buy;

    CREATE VIEW latest_buy AS
    SELECT
      tr.id,
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
      WHERE newer.fund_id = tr.fund_id
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
      f.id AS fund_id,
      f.code,
      f.name,
      COALESCE(ss.drop_rate, 0.04) AS drop_rate,
      lb.buy_date AS last_buy_date,
      lb.buy_nav AS last_buy_nav,
      ln.nav_date AS latest_nav_date,
      ln.unit_nav AS latest_nav,
      ROUND(lb.buy_nav * (1 - COALESCE(ss.drop_rate, 0.04)), 6) AS trigger_nav,
      CASE
        WHEN lb.buy_nav IS NULL OR ln.unit_nav IS NULL THEN NULL
        WHEN lb.buy_nav * (1 - COALESCE(ss.drop_rate, 0.04)) >= ln.unit_nav THEN 0
        ELSE ROUND(
          (1 - (lb.buy_nav * (1 - COALESCE(ss.drop_rate, 0.04)) / ln.unit_nav)) * 100,
          4
        )
      END AS required_drop_percent,
      CASE
        WHEN lb.buy_nav IS NULL THEN 'missing_buy'
        WHEN ln.unit_nav IS NULL THEN 'missing_nav'
        WHEN lb.buy_nav * (1 - COALESCE(ss.drop_rate, 0.04)) >= ln.unit_nav THEN 'triggered'
        ELSE 'waiting'
      END AS status
    FROM funds f
    LEFT JOIN strategy_settings ss ON ss.fund_id = f.id
    LEFT JOIN latest_buy lb ON lb.fund_id = f.id
    LEFT JOIN latest_nav ln ON ln.fund_id = f.id
    WHERE f.is_active = 1;
  `);
}
