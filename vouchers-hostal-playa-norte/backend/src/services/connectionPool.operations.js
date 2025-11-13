import { recordDbError } from '../middleware/metrics.js';
import { logger } from '../config/logger.js';

export async function execute(sql, params = []) {
  const connObj = await this.acquireConnection();
  try {
    const stmt = connObj.db.prepare(sql);
    const result = stmt.run(...params);
    return result;
  } catch (error) {
    try { recordDbError('execute', error.code || error.name || 'unknown'); } catch (_) { /* metric ignore */ }
    throw error;
  } finally {
    this.releaseConnection(connObj);
  }
}

export async function query(sql, params = []) {
  const connObj = await this.acquireConnection();
  try {
    const stmt = connObj.db.prepare(sql);
    const results = stmt.all(...params);
    return results;
  } catch (error) {
    try { recordDbError('query', error.code || error.name || 'unknown'); } catch (_) { /* metric ignore */ }
    throw error;
  } finally {
    this.releaseConnection(connObj);
  }
}

export async function queryOne(sql, params = []) {
  const connObj = await this.acquireConnection();
  try {
    const stmt = connObj.db.prepare(sql);
    const result = stmt.get(...params);
    return result;
  } catch (error) {
    try { recordDbError('query_one', error.code || error.name || 'unknown'); } catch (_) { /* metric ignore */ }
    throw error;
  } finally {
    this.releaseConnection(connObj);
  }
}

export function prepareStatement(sql) {
  if (this.prepared.has(sql)) {
    return this.prepared.get(sql);
  }
  const conn = this.connections[0];
  if (!conn) {
    throw new Error('No connections available for statement preparation');
  }
  const stmt = conn.db.prepare(sql);
  this.prepared.set(sql, stmt);
  logger.debug({ event: 'pool_statement_prepared', totalPrepared: this.prepared.size });
  return stmt;
}

export async function executeStatement(sql, params = []) {
  this.prepareStatement(sql); // caching side-effect
  const connObj = await this.acquireConnection();
  try {
    const currentStmt = connObj.db.prepare(sql);
    return currentStmt.run(...params);
  } catch (error) {
    try { recordDbError('execute_statement', error.code || error.name || 'unknown'); } catch (_) { /* metric ignore */ }
    throw error;
  } finally {
    this.releaseConnection(connObj);
  }
}

export async function beginTransaction() {
  const connObj = await this.acquireConnection();
  connObj.inTransaction = true;
  connObj.db.exec('BEGIN TRANSACTION');
  return connObj;
}

export function commitTransaction(connObj) {
  try {
    connObj.db.exec('COMMIT');
    connObj.inTransaction = false;
    this.releaseConnection(connObj);
    logger.debug({ event: 'transaction_committed' });
    return true;
  } catch (error) {
    logger.error({ event: 'transaction_commit_error', error: error.message, stack: error.stack });
    try { recordDbError('commit', error.code || error.name || 'unknown'); } catch (_) { /* metric ignore */ }
    return false;
  }
}

export function rollbackTransaction(connObj) {
  try {
    connObj.db.exec('ROLLBACK');
    connObj.inTransaction = false;
    this.releaseConnection(connObj);
    logger.warn({ event: 'transaction_rolled_back' });
    return true;
  } catch (error) {
    logger.error({ event: 'transaction_rollback_error', error: error.message, stack: error.stack });
    try { recordDbError('rollback', error.code || error.name || 'unknown'); } catch (_) { /* metric ignore */ }
    return false;
  }
}

export async function drain() {
  try {
    const promises = this.connections.map((conn) => new Promise((resolve) => { this.closeConnection(conn); resolve(); }));
    await Promise.all(promises);
    this.prepared.clear();
    this.waiting = [];
    this.connections = [];
    this.available = [];
    logger.info({ event: 'pool_drained' });
    return true;
  } catch (error) {
    logger.error({ event: 'pool_drain_error', error: error.message, stack: error.stack });
    this.stats.errors++;
    try { recordDbError('pool_drain', error.code || error.name || 'unknown'); } catch (_) { /* metric ignore */ }
    return false;
  }
}

export function getStats() {
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

export async function healthCheck() {
  try {
    const result = await this.queryOne('SELECT 1 as health');
    return { healthy: true, response: result };
  } catch (error) {
    logger.error({ event: 'pool_health_check_failed', error: error.message, stack: error.stack });
    return { healthy: false, error: error.message };
  }
}

export function vacuum() {
  try {
    const conn = this.connections[0];
    if (!conn) {
      throw new Error('No connections available');
    }
    conn.db.exec('VACUUM');
    logger.info({ event: 'database_vacuumed' });
    return true;
  } catch (error) {
    logger.error({ event: 'vacuum_error', error: error.message, stack: error.stack });
    this.stats.errors++;
    try { recordDbError('vacuum', error.code || error.name || 'unknown'); } catch (_) { /* metric ignore */ }
    return false;
  }
}

export function clearPreparedCache() {
  const count = this.prepared.size;
  this.prepared.clear();
  logger.info({ event: 'prepared_cache_cleared', count });
  return count;
}
