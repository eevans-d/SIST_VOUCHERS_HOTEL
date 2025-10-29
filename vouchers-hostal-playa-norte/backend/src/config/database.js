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

    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../vouchers.db');
    const dbDir = path.dirname(dbPath);

    // Crear directorio si no existe
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    try {
      this.db = new Database(dbPath, {
        verbose: process.env.NODE_ENV === 'development' ? console.log : null
      });

      // Configuraciones SQLite optimizadas
      this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging para concurrencia
      this.db.pragma('foreign_keys = ON');  // Integridad referencial
      this.db.pragma('synchronous = NORMAL'); // Balance performance/seguridad
      
      // Configurar zona horaria
      this.db.function('current_timestamp_tz', () => {
        return new Date().toISOString();
      });

      this.initialized = true;
      
      logger.info({
        event: 'database_initialized',
        path: dbPath,
        pragmas: {
          journal_mode: this.db.pragma('journal_mode', { simple: true }),
          foreign_keys: this.db.pragma('foreign_keys', { simple: true })
        }
      });

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

// Singleton
const dbManager = new DatabaseManager();

export const dbManager = new DatabaseManager();
export const getDb = () => dbManager.getDb();