import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from './logger.js';

class DatabaseManager {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return this.db;

    const dbPath =
      process.env.DATABASE_PATH || path.join(__dirname, '../../vouchers.db');
    ensureDbDir(dbPath);

    try {
      this.db = openDatabase(dbPath);
      configureSqlite(this.db);

      this.initialized = true;

      logInitialization(dbPath, this.db);

      return this.db;
    } catch (error) {
      logger.error({
        event: 'database_initialization_failed',
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  getDb() {
    if (!this.initialized) {
      return this.initialize();
    }
    return this.db;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.initialized = false;
      logger.info({ event: 'database_closed' });
    }
  }

  // Transacción helper
  transaction(callback) {
    const db = this.getDb();
    return db.transaction(callback);
  }
}

// Singleton exportado
export const dbManager = new DatabaseManager();
export const getDb = () => dbManager.getDb();

// Helpers privados del módulo
function ensureDbDir(dbPath) {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

function openDatabase(dbPath) {
  return new Database(dbPath, {
    verbose:
      process.env.NODE_ENV === 'development'
        ? (msg) => logger.debug({ event: 'sqlite_verbose', sql: msg })
        : null
  });
}

function configureSqlite(db) {
  db.pragma('journal_mode = WAL'); // Write-Ahead Logging para concurrencia
  db.pragma('foreign_keys = ON'); // Integridad referencial
  db.pragma('synchronous = NORMAL'); // Balance performance/seguridad
  db.function('current_timestamp_tz', () => new Date().toISOString());
}

function logInitialization(dbPath, db) {
  logger.info({
    event: 'database_initialized',
    path: dbPath,
    pragmas: {
      journal_mode: db.pragma('journal_mode', { simple: true }),
      foreign_keys: db.pragma('foreign_keys', { simple: true })
    }
  });
}
