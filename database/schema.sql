PRAGMA foreign_keys = ON;
PRAGMA user_version = 1;

DROP VIEW IF EXISTS fund_trigger_status;
DROP VIEW IF EXISTS latest_buy;

CREATE TABLE IF NOT EXISTS funds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  fund_type TEXT,
  currency TEXT NOT NULL DEFAULT 'CNY',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_funds_name ON funds (name);

CREATE TRIGGER IF NOT EXISTS trg_funds_updated_at
AFTER UPDATE ON funds
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE funds SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS strategy_settings (
  fund_id INTEGER PRIMARY KEY,
  drop_rate REAL NOT NULL DEFAULT 0.04 CHECK (drop_rate > 0 AND drop_rate < 1),
  buy_unit_amount REAL CHECK (buy_unit_amount IS NULL OR buy_unit_amount > 0),
  trigger_basis TEXT NOT NULL DEFAULT 'last_buy_nav'
    CHECK (trigger_basis IN ('last_buy_nav')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (fund_id) REFERENCES funds (id) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS trg_strategy_settings_updated_at
AFTER UPDATE ON strategy_settings
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE strategy_settings SET updated_at = datetime('now') WHERE fund_id = NEW.fund_id;
END;

CREATE TABLE IF NOT EXISTS nav_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fund_id INTEGER NOT NULL,
  nav_date TEXT NOT NULL CHECK (date(nav_date) = nav_date),
  unit_nav REAL NOT NULL CHECK (unit_nav > 0),
  accumulated_nav REAL CHECK (accumulated_nav IS NULL OR accumulated_nav > 0),
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (fund_id) REFERENCES funds (id) ON DELETE CASCADE,
  UNIQUE (fund_id, nav_date)
);

CREATE INDEX IF NOT EXISTS idx_nav_history_fund_date
  ON nav_history (fund_id, nav_date DESC);

CREATE TABLE IF NOT EXISTS nav_sync_state (
  fund_id INTEGER PRIMARY KEY,
  full_history_synced INTEGER NOT NULL DEFAULT 0 CHECK (full_history_synced IN (0, 1)),
  full_history_synced_at TEXT,
  last_incremental_sync_at TEXT,
  FOREIGN KEY (fund_id) REFERENCES funds (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS buy_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fund_id INTEGER NOT NULL,
  buy_date TEXT NOT NULL CHECK (date(buy_date) = buy_date),
  buy_nav REAL NOT NULL CHECK (buy_nav > 0),
  amount REAL CHECK (amount IS NULL OR amount > 0),
  shares REAL CHECK (shares IS NULL OR shares > 0),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (fund_id) REFERENCES funds (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_buy_records_fund_date
  ON buy_records (fund_id, buy_date DESC, id DESC);

CREATE TABLE IF NOT EXISTS trade_records (
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

CREATE INDEX IF NOT EXISTS idx_trade_records_fund_date
  ON trade_records (fund_id, trade_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_trade_records_source_buy
  ON trade_records (source_buy_id)
  WHERE source_buy_id IS NOT NULL;

CREATE VIEW IF NOT EXISTS latest_nav AS
SELECT nh.*
FROM nav_history nh
WHERE NOT EXISTS (
  SELECT 1
  FROM nav_history newer
  WHERE newer.fund_id = nh.fund_id
    AND (
      newer.nav_date > nh.nav_date
      OR (newer.nav_date = nh.nav_date AND newer.id > nh.id)
    )
);

CREATE VIEW IF NOT EXISTS latest_buy AS
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
    AND (
      newer.trade_date > tr.trade_date
      OR (newer.trade_date = tr.trade_date AND newer.id > tr.id)
    )
)
  AND tr.trade_type = 'buy';

CREATE VIEW IF NOT EXISTS fund_trigger_status AS
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
