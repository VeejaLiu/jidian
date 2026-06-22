PRAGMA foreign_keys = ON;
PRAGMA user_version = 1;

DROP VIEW IF EXISTS fund_trigger_status;
DROP VIEW IF EXISTS latest_buy;

CREATE TABLE IF NOT EXISTS funds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'fund' CHECK (asset_type IN ('fund', 'stock')),
  fund_type TEXT,
  currency TEXT NOT NULL DEFAULT 'CNY',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
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

INSERT INTO user_accounts (name)
SELECT '默认账户'
WHERE NOT EXISTS (SELECT 1 FROM user_accounts);

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
  account_id INTEGER NOT NULL DEFAULT 1,
  fund_id INTEGER NOT NULL,
  buy_date TEXT NOT NULL CHECK (date(buy_date) = buy_date),
  buy_nav REAL NOT NULL CHECK (buy_nav > 0),
  amount REAL CHECK (amount IS NULL OR amount > 0),
  shares REAL CHECK (shares IS NULL OR shares > 0),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES user_accounts (id) ON DELETE CASCADE,
  FOREIGN KEY (fund_id) REFERENCES funds (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_buy_records_fund_date
  ON buy_records (fund_id, buy_date DESC, id DESC);

CREATE TABLE IF NOT EXISTS trade_records (
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

CREATE INDEX IF NOT EXISTS idx_trade_records_fund_date
  ON trade_records (account_id, fund_id, trade_date DESC, id DESC);

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
