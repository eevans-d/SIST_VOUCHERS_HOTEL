/* eslint-disable indent */
/**
 * Database Connection Pool Service
 * Manages SQLite connections with connection pooling and prepared statements
 */

// import sqlite3 from 'sqlite3'; // eliminado por no uso actual
import { Database } from 'better-sqlite3';
import { recordDbError } from '../middleware/metrics.js';
import { logger } from '../config/logger.js';
import * as poolOps from './connectionPool.operations.js';
// fs y path no se usan en esta implementación; se podrían eliminar si se agrega persistencia.

export class ConnectionPool {
  constructor(config = {}) {
    this.config = {
      filename: config.filename || ':memory:',
      maxConnections: config.maxConnections || 10,
      idleTimeout: config.idleTimeout || 30000, // 30 seconds
      acquireTimeout: config.acquireTimeout || 5000, // 5 seconds
      ...config
    };

    this.connections = [];
    this.available = [];
    this.waiting = [];
    this.prepared = new Map(); // Cache de statements preparados
    this.stats = {
      created: 0,
      acquired: 0,
      released: 0,
      reused: 0,
      errors: 0
    };
  }

  /**
   * Initialize connection pool
   */
  async initialize() {
    try {
      // Crear conexiones iniciales
      for (let i = 0; i < this.config.maxConnections; i++) {
        const conn = new Database(this.config.filename);

        // Enable WAL mode para mejor concurrencia
        conn.pragma('journal_mode = WAL');

        // Connection object
        const connObj = {
          id: i,
          db: conn,
          inUse: false,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          idleTimer: null,
          acquiredCount: 0
        };

        this.connections.push(connObj);
        this.available.push(connObj);
        this.stats.created++;
      }

      logger.info({ event: 'pool_initialized', maxConnections: this.config.maxConnections });
      return true;
    } catch (error) {
  logger.error({ event: 'pool_initialize_failed', error: error.message, stack: error.stack });
      this.stats.errors++;
      try {
        recordDbError('pool_initialize', error.code || error.name || 'unknown');
      } catch (_) { /* metric ignore */ }
      throw error;
    }
  }

  /**
   * Acquire connection from pool
   */
  async acquireConnection() {
    try {
      const immediate = this._getImmediateConnection();
      if (immediate) return immediate;
      if (this.connections.length < this.config.maxConnections) return this._createAndAcquireConnection();
      return this._enqueueWaiter();
    } catch (error) {
      logger.error({ event: 'pool_acquire_error', error: error.message, stack: error.stack });
      this.stats.errors++;
      try { recordDbError('pool_acquire', error.code || error.name || 'unknown'); } catch (_) { /* metric ignore */ }
      throw error;
    }
  }

  _getImmediateConnection() {
    if (this.available.length === 0) return null;
    const conn = this.available.shift();
    conn.inUse = true;
    conn.lastUsed = Date.now();
    conn.acquiredCount++;
    if (conn.idleTimer) { clearTimeout(conn.idleTimer); conn.idleTimer = null; }
    this.stats.acquired++;
    this.stats.reused++;
    logger.debug({ event: 'pool_connection_acquired', available: this.available.length });
    return conn;
  }

  _createAndAcquireConnection() {
    const conn = new Database(this.config.filename);
    conn.pragma('journal_mode = WAL');
    const connObj = {
      id: this.connections.length,
      db: conn,
      inUse: true,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      idleTimer: null,
      acquiredCount: 1
    };
    this.connections.push(connObj);
    this.stats.created++;
    this.stats.acquired++;
    logger.info({ event: 'pool_connection_created', total: this.connections.length });
    return connObj;
  }

  _enqueueWaiter() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { reject(new Error('Connection acquire timeout')); }, this.config.acquireTimeout);
      this.waiting.push({ resolve, reject, timeout });
      logger.warn({ event: 'pool_waiting_queue', waiting: this.waiting.length });
    });
  }

  /**
   * Release connection back to pool
   */
  releaseConnection(connObj) {
    try {
      if (!connObj || !connObj.db) {
  logger.error({ event: 'pool_release_invalid_object' });
        this.stats.errors++;
        return false;
      }

      // Si hay requests esperando, asignar al primero
      if (this.waiting.length > 0) {
        const { resolve, timeout } = this.waiting.shift();
        clearTimeout(timeout);

        connObj.inUse = false;
        connObj.lastUsed = Date.now();
        connObj.acquiredCount++;

        resolve(connObj);
    this.stats.released++;
  logger.debug({ event: 'pool_released_to_waiter' });
        return true;
      }

      // Si no hay requests esperando, devolver al pool
      connObj.inUse = false;
      connObj.lastUsed = Date.now();

      // Configurar idle timer
      if (connObj.idleTimer) clearTimeout(connObj.idleTimer);
      connObj.idleTimer = setTimeout(() => {
        this.closeConnection(connObj);
      }, this.config.idleTimeout);

      this.available.push(connObj);
      this.stats.released++;

      logger.debug({ event: 'pool_connection_released', available: this.available.length });
      return true;
    } catch (error) {
  logger.error({ event: 'pool_release_error', error: error.message, stack: error.stack });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Close connection
   */
  closeConnection(connObj) {
    try {
      if (connObj.db) {
        connObj.db.close();
      }
      if (connObj.idleTimer) {
        clearTimeout(connObj.idleTimer);
      }

      const index = this.connections.indexOf(connObj);
      if (index > -1) {
        this.connections.splice(index, 1);
      }

      const availIndex = this.available.indexOf(connObj);
      if (availIndex > -1) {
        this.available.splice(availIndex, 1);
      }

      logger.info({ event: 'pool_connection_closed', remaining: this.connections.length });
      return true;
    } catch (error) {
  logger.error({ event: 'pool_close_error', error: error.message, stack: error.stack });
      try {
        recordDbError('pool_close', error.code || error.name || 'unknown');
      } catch (_) { /* metric ignore */ }
      return false;
    }
  }
}

/**
 * Singleton instance
 */
let poolInstance = null;

export const initializePool = async (config) => {
  if (poolInstance) {
    return poolInstance;
  }

  poolInstance = new ConnectionPool(config);
  await poolInstance.initialize();
  poolInstance.startTime = Date.now();
  return poolInstance;
};

export const getPool = () => {
  if (!poolInstance) {
    throw new Error(
      'Connection pool not initialized. Call initializePool first.'
    );
  }
  return poolInstance;
};

export default ConnectionPool;

// Adjuntar operaciones extraídas al prototipo para mantener API
Object.assign(ConnectionPool.prototype, poolOps);
