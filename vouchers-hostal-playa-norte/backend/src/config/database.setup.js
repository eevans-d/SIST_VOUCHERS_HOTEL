/**
 * @file database.setup.js
 * @description Inicialización de base de datos (SQLite + PostgreSQL)
 */

import Database from 'better-sqlite3';
import postgresAdapter from '../infrastructure/database/postgres.adapter.js';
import { config } from './app.config.js';
import { logger } from './logger.setup.js';
import { recordDbError } from '../middleware/metrics.js';

export function initializeDatabases() {
  let db = null;
  let pgPool = null;

  // Inicializar SQLite
  try {
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    logger.info(`✅ SQLite inicializado: ${config.dbPath}`);
  } catch (error) {
    logger.error('❌ Error inicializando SQLite:', error);
    recordDbError('connect', error.code || error.name || 'unknown');
    if (config.nodeEnv !== 'test') {
      process.exit(1);
    }
  }

  // Inicializar PostgreSQL si configurado
  if (config.dbEngine === 'postgres') {
    if (!config.databaseUrl) {
      logger.error(
        '❌ DATABASE_URL no definida. Establecer variable de entorno para PostgreSQL.'
      );
    } else {
      try {
        pgPool = postgresAdapter.initializePool(config.databaseUrl);
        pgPool.query('SELECT 1');
        logger.info('✅ Conexión PostgreSQL establecida (modo híbrido).');
      } catch (err) {
        logger.error(
          '❌ Fallo conectando a PostgreSQL, continuando sólo con SQLite:',
          err.message
        );
        recordDbError('connect_pg', err.code || err.message || 'unknown');
        pgPool = null;
      }
    }
  }

  return { db, pgPool };
}
