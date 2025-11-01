/**
 * Database Connection Pool Service
 * Manages SQLite connections with connection pooling and prepared statements
 */

import sqlite3 from 'sqlite3';
import { Database } from 'better-sqlite3';
import { recordDbError } from '../middleware/metrics.js';
import * as fs from 'fs';
import * as path from 'path';

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

      console.log(
        `✅ Connection pool initialized: ${this.config.maxConnections} connections`
      );
      return true;
    } catch (error) {
      console.error('❌ Connection pool initialization failed:', error);
      this.stats.errors++;
      try {
        recordDbError('pool_initialize', error.code || error.name || 'unknown');
      } catch (_) {}
      throw error;
    }
  }

  /**
   * Acquire connection from pool
   */
  async acquireConnection() {
    try {
      // Si hay conexión disponible, usarla
      if (this.available.length > 0) {
        const conn = this.available.shift();
        conn.inUse = true;
        conn.lastUsed = Date.now();
        conn.acquiredCount++;

        // Limpiar idle timer si existe
        if (conn.idleTimer) {
          clearTimeout(conn.idleTimer);
          conn.idleTimer = null;
        }

        this.stats.acquired++;
        this.stats.reused++;

        console.log(
          `✅ Connection acquired (${this.available.length} available)`
        );
        return conn;
      }

      // Si no hay disponible y no hemos alcanzado máximo, crear una nueva
      if (this.connections.length < this.config.maxConnections) {
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

        console.log(
          `✅ New connection created (total: ${this.connections.length})`
        );
        return connObj;
      }

      // Si no hay disponible, esperar
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection acquire timeout'));
        }, this.config.acquireTimeout);

        this.waiting.push({ resolve, reject, timeout });
        console.log(
          `⏳ Waiting for connection (${this.waiting.length} waiting)`
        );
      });
    } catch (error) {
      console.error('❌ Connection acquire error:', error);
      this.stats.errors++;
      try {
        recordDbError('pool_acquire', error.code || error.name || 'unknown');
      } catch (_) {}
      throw error;
    }
  }

  /**
   * Release connection back to pool
   */
  releaseConnection(connObj) {
    try {
      if (!connObj || !connObj.db) {
        console.error('❌ Invalid connection object');
        this.stats.errors++;
        return false;
      }

      // Si hay requests esperando, asignar al primero
      if (this.waiting.length > 0) {
        const { resolve, reject, timeout } = this.waiting.shift();
        clearTimeout(timeout);

        connObj.inUse = false;
        connObj.lastUsed = Date.now();
        connObj.acquiredCount++;

        resolve(connObj);
        this.stats.released++;
        console.log('✅ Connection released to waiting request');
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

      console.log(
        `✅ Connection released (${this.available.length} available)`
      );
      return true;
    } catch (error) {
      console.error('❌ Connection release error:', error);
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

      console.log(
        `🗑️ Connection closed (${this.connections.length} remaining)`
      );
      return true;
    } catch (error) {
      console.error('❌ Connection close error:', error);
      try {
        recordDbError('pool_close', error.code || error.name || 'unknown');
      } catch (_) {}
      return false;
    }
  }

  /**
   * Execute query with automatic connection management
   */
  async execute(sql, params = []) {
    const connObj = await this.acquireConnection();
    try {
      const stmt = connObj.db.prepare(sql);
      const result = stmt.run(...params);
      return result;
    } catch (error) {
      try {
        recordDbError('execute', error.code || error.name || 'unknown');
      } catch (_) {}
      throw error;
    } finally {
      this.releaseConnection(connObj);
    }
  }

  /**
   * Execute query and get all results
   */
  async query(sql, params = []) {
    const connObj = await this.acquireConnection();
    try {
      const stmt = connObj.db.prepare(sql);
      const results = stmt.all(...params);
      return results;
    } catch (error) {
      try {
        recordDbError('query', error.code || error.name || 'unknown');
      } catch (_) {}
      throw error;
    } finally {
      this.releaseConnection(connObj);
    }
  }

  /**
   * Execute query and get single result
   */
  async queryOne(sql, params = []) {
    const connObj = await this.acquireConnection();
    try {
      const stmt = connObj.db.prepare(sql);
      const result = stmt.get(...params);
      return result;
    } catch (error) {
      try {
        recordDbError('query_one', error.code || error.name || 'unknown');
      } catch (_) {}
      throw error;
    } finally {
      this.releaseConnection(connObj);
    }
  }

  /**
   * Prepare statement for reuse (caching)
   */
  prepareStatement(sql) {
    if (this.prepared.has(sql)) {
      return this.prepared.get(sql);
    }

    // Usar primera conexión disponible para preparar
    const conn = this.connections[0];
    if (!conn) {
      throw new Error('No connections available for statement preparation');
    }

    const stmt = conn.db.prepare(sql);
    this.prepared.set(sql, stmt);

    console.log(`📝 Statement prepared (total: ${this.prepared.size})`);
    return stmt;
  }

  /**
   * Execute prepared statement
   */
  async executeStatement(sql, params = []) {
    const stmt = this.prepareStatement(sql);
    const connObj = await this.acquireConnection();
    try {
      // Re-prepare con conexión actual si es necesario
      const currentStmt = connObj.db.prepare(sql);
      return currentStmt.run(...params);
    } catch (error) {
      try {
        recordDbError(
          'execute_statement',
          error.code || error.name || 'unknown'
        );
      } catch (_) {}
      throw error;
    } finally {
      this.releaseConnection(connObj);
    }
  }

  /**
   * Begin transaction
   */
  async beginTransaction() {
    const connObj = await this.acquireConnection();
    connObj.inTransaction = true;
    connObj.db.exec('BEGIN TRANSACTION');
    return connObj;
  }

  /**
   * Commit transaction
   */
  commitTransaction(connObj) {
    try {
      connObj.db.exec('COMMIT');
      connObj.inTransaction = false;
      this.releaseConnection(connObj);
      console.log('✅ Transaction committed');
      return true;
    } catch (error) {
      console.error('❌ Transaction commit error:', error);
      try {
        recordDbError('commit', error.code || error.name || 'unknown');
      } catch (_) {}
      return false;
    }
  }

  /**
   * Rollback transaction
   */
  rollbackTransaction(connObj) {
    try {
      connObj.db.exec('ROLLBACK');
      connObj.inTransaction = false;
      this.releaseConnection(connObj);
      console.log('↩️ Transaction rolled back');
      return true;
    } catch (error) {
      console.error('❌ Transaction rollback error:', error);
      try {
        recordDbError('rollback', error.code || error.name || 'unknown');
      } catch (_) {}
      return false;
    }
  }

  /**
   * Drain pool - close all connections
   */
  async drain() {
    try {
      const promises = this.connections.map(
        (conn) =>
          new Promise((resolve) => {
            this.closeConnection(conn);
            resolve();
          })
      );

      await Promise.all(promises);

      // Limpiar prepared statements
      this.prepared.clear();
      this.waiting = [];
      this.connections = [];
      this.available = [];

      console.log('🗑️ Connection pool drained');
      return true;
    } catch (error) {
      console.error('❌ Pool drain error:', error);
      this.stats.errors++;
      try {
        recordDbError('pool_drain', error.code || error.name || 'unknown');
      } catch (_) {}
      return false;
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      ...this.stats,
      totalConnections: this.connections.length,
      availableConnections: this.available.length,
      usedConnections: this.connections.length - this.available.length,
      waitingRequests: this.waiting.length,
      preparedStatements: this.prepared.size,
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const result = await this.queryOne('SELECT 1 as health');
      return { healthy: true, response: result };
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Vacuum database
   */
  vacuum() {
    try {
      const conn = this.connections[0];
      if (!conn) {
        throw new Error('No connections available');
      }

      conn.db.exec('VACUUM');
      console.log('🧹 Database vacuumed');
      return true;
    } catch (error) {
      console.error('❌ Vacuum error:', error);
      this.stats.errors++;
      try {
        recordDbError('vacuum', error.code || error.name || 'unknown');
      } catch (_) {}
      return false;
    }
  }

  /**
   * Clear prepared statement cache
   */
  clearPreparedCache() {
    const count = this.prepared.size;
    this.prepared.clear();
    console.log(`🗑️ Prepared statements cache cleared (${count} statements)`);
    return count;
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
