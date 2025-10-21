-- Schema Constitucional para Sistema de Vouchers
-- Ref: BLUEPRINT_ARQUITECTURA.md

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Tabla: users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'reception', 'cafeteria')),
  cafeteria_id INTEGER,
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Tabla: cafeterias
CREATE TABLE IF NOT EXISTS cafeterias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Tabla: stays
CREATE TABLE IF NOT EXISTS stays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_name TEXT NOT NULL,
  room_number TEXT NOT NULL,
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  breakfast_count INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Tabla: vouchers
CREATE TABLE IF NOT EXISTS vouchers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  stay_id INTEGER NOT NULL,
  valid_from TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  hmac_signature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'redeemed', 'expired', 'cancelled')),
  qr_code_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  created_by INTEGER NOT NULL,
  FOREIGN KEY (stay_id) REFERENCES stays(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Tabla: redemptions (UNIQUE constraint crítico - Pilar 8.1)
CREATE TABLE IF NOT EXISTS redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id INTEGER NOT NULL UNIQUE,  -- ⚠️ CRÍTICO: Previene doble canje
  cafeteria_id INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  redeemed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  redeemed_by INTEGER NOT NULL,
  sync_status TEXT DEFAULT 'synced' CHECK(sync_status IN ('synced', 'pending', 'conflict')),
  FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
  FOREIGN KEY (cafeteria_id) REFERENCES cafeterias(id),
  FOREIGN KEY (redeemed_by) REFERENCES users(id)
);

-- Tabla: sync_log
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  status TEXT NOT NULL,
  details TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_redemptions_voucher ON redemptions(voucher_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_device ON redemptions(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_device ON sync_log(device_id);

