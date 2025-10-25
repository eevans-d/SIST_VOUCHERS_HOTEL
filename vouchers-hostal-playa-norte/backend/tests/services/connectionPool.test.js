import { describe, it, expect, beforeEach, afterEach, vi } from '@jest/globals';
import { ConnectionPool, initializePool, getPool } from '../services/connectionPool.js';

describe('ConnectionPool', () => {
  let pool;

  beforeEach(async () => {
    pool = new ConnectionPool({
      filename: ':memory:',
      maxConnections: 5,
      idleTimeout: 5000,
      acquireTimeout: 2000,
    });
    await pool.initialize();
  });

  afterEach(async () => {
    if (pool) {
      await pool.drain();
    }
  });

  describe('Initialization', () => {
    it('should initialize pool with default connections', async () => {
      expect(pool.connections.length).toBe(5);
      expect(pool.available.length).toBe(5);
      expect(pool.stats.created).toBe(5);
    });

    it('should initialize with custom max connections', async () => {
      const customPool = new ConnectionPool({
        filename: ':memory:',
        maxConnections: 10,
      });
      await customPool.initialize();

      expect(customPool.connections.length).toBe(10);
      await customPool.drain();
    });

    it('should enable WAL mode on connections', async () => {
      const result = pool.connections[0].db.pragma('journal_mode');
      expect(result.toLowerCase()).toBe('wal');
    });

    it('should set initial connection state correctly', async () => {
      const conn = pool.connections[0];
      expect(conn.inUse).toBe(false);
      expect(conn.createdAt).toBeDefined();
      expect(conn.lastUsed).toBeDefined();
      expect(conn.acquiredCount).toBe(0);
    });
  });

  describe('Connection Acquisition', () => {
    it('should acquire available connection', async () => {
      const conn = await pool.acquireConnection();
      expect(conn).toBeDefined();
      expect(conn.inUse).toBe(true);
      expect(pool.available.length).toBe(4);
    });

    it('should acquire all available connections', async () => {
      const conns = [];
      for (let i = 0; i < 5; i++) {
        const conn = await pool.acquireConnection();
        conns.push(conn);
      }

      expect(pool.available.length).toBe(0);
      expect(conns.length).toBe(5);

      conns.forEach(conn => pool.releaseConnection(conn));
    });

    it('should create new connection if under max', async () => {
      const conn1 = await pool.acquireConnection();
      const conn2 = await pool.acquireConnection();

      expect(pool.connections.length).toBe(5);
      expect(conn1.id !== conn2.id).toBe(true);

      pool.releaseConnection(conn1);
      pool.releaseConnection(conn2);
    });

    it('should wait for available connection', async () => {
      // Acquire all connections
      const conns = [];
      for (let i = 0; i < 5; i++) {
        conns.push(await pool.acquireConnection());
      }

      // Try to acquire one more (should wait)
      let waitingConn = null;
      const promise = pool.acquireConnection().then(conn => {
        waitingConn = conn;
      });

      expect(pool.waiting.length).toBe(1);

      // Release one
      pool.releaseConnection(conns[0]);

      await promise;
      expect(waitingConn).toBeDefined();

      conns.slice(1).forEach(conn => pool.releaseConnection(conn));
      pool.releaseConnection(waitingConn);
    });

    it('should timeout if no connection available', async () => {
      // Acquire all
      const conns = [];
      for (let i = 0; i < 5; i++) {
        conns.push(await pool.acquireConnection());
      }

      // Try to acquire (should timeout)
      await expect(pool.acquireConnection()).rejects.toThrow('Connection acquire timeout');

      conns.forEach(conn => pool.releaseConnection(conn));
    });

    it('should track acquired count', async () => {
      const conn = await pool.acquireConnection();
      expect(conn.acquiredCount).toBe(1);

      pool.releaseConnection(conn);

      const conn2 = await pool.acquireConnection();
      expect(conn2.acquiredCount).toBe(2);

      pool.releaseConnection(conn2);
    });
  });

  describe('Connection Release', () => {
    it('should release connection back to pool', async () => {
      const conn = await pool.acquireConnection();
      expect(pool.available.length).toBe(4);

      pool.releaseConnection(conn);
      expect(pool.available.length).toBe(5);
    });

    it('should assign released connection to waiting request', async () => {
      const conns = [];
      for (let i = 0; i < 5; i++) {
        conns.push(await pool.acquireConnection());
      }

      const promise = pool.acquireConnection();
      expect(pool.waiting.length).toBe(1);

      pool.releaseConnection(conns[0]);

      const acquiredConn = await promise;
      expect(acquiredConn).toBeDefined();
      expect(pool.waiting.length).toBe(0);

      conns.slice(1).forEach(conn => pool.releaseConnection(conn));
      pool.releaseConnection(acquiredConn);
    });

    it('should set idle timer on release', async () => {
      const conn = await pool.acquireConnection();
      pool.releaseConnection(conn);

      expect(conn.idleTimer).toBeDefined();
    });

    it('should handle invalid connection', async () => {
      const result = pool.releaseConnection(null);
      expect(result).toBe(false);
      expect(pool.stats.errors).toBe(1);
    });
  });

  describe('Query Execution', () => {
    beforeEach(() => {
      const conn = pool.connections[0];
      conn.db.exec(`
        CREATE TABLE test_users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE
        )
      `);
    });

    it('should execute INSERT query', async () => {
      const result = await pool.execute(
        'INSERT INTO test_users (name, email) VALUES (?, ?)',
        ['John', 'john@example.com']
      );

      expect(result.changes).toBe(1);
    });

    it('should query all results', async () => {
      await pool.execute(
        'INSERT INTO test_users (name, email) VALUES (?, ?)',
        ['John', 'john@example.com']
      );
      await pool.execute(
        'INSERT INTO test_users (name, email) VALUES (?, ?)',
        ['Jane', 'jane@example.com']
      );

      const results = await pool.query('SELECT * FROM test_users');
      expect(results.length).toBe(2);
      expect(results[0].name).toBe('John');
    });

    it('should query single result', async () => {
      await pool.execute(
        'INSERT INTO test_users (name, email) VALUES (?, ?)',
        ['John', 'john@example.com']
      );

      const result = await pool.queryOne(
        'SELECT * FROM test_users WHERE name = ?',
        ['John']
      );

      expect(result.name).toBe('John');
      expect(result.email).toBe('john@example.com');
    });

    it('should handle parameterized queries', async () => {
      await pool.execute(
        'INSERT INTO test_users (name, email) VALUES (?, ?)',
        ['Alice', 'alice@example.com']
      );

      const result = await pool.queryOne(
        'SELECT * FROM test_users WHERE email = ?',
        ['alice@example.com']
      );

      expect(result.name).toBe('Alice');
    });

    it('should release connection after query', async () => {
      expect(pool.available.length).toBe(5);

      await pool.query('SELECT 1');

      expect(pool.available.length).toBe(5);
    });
  });

  describe('Prepared Statements', () => {
    it('should prepare and cache statement', () => {
      const stmt = pool.prepareStatement('SELECT 1 as test');
      expect(stmt).toBeDefined();
      expect(pool.prepared.size).toBe(1);
    });

    it('should reuse prepared statement', () => {
      pool.prepareStatement('SELECT 1 as test');
      const cached = pool.prepareStatement('SELECT 1 as test');

      expect(pool.prepared.size).toBe(1);
      expect(cached).toBeDefined();
    });

    it('should cache multiple statements', () => {
      pool.prepareStatement('SELECT 1 as test1');
      pool.prepareStatement('SELECT 2 as test2');
      pool.prepareStatement('SELECT 3 as test3');

      expect(pool.prepared.size).toBe(3);
    });

    it('should execute prepared statement', async () => {
      await pool.execute('CREATE TABLE prep_test (id INTEGER, value TEXT)');
      await pool.execute('INSERT INTO prep_test VALUES (1, "test")');

      const result = await pool.executeStatement(
        'SELECT * FROM prep_test WHERE id = ?',
        [1]
      );

      expect(result).toBeDefined();
    });

    it('should clear prepared statements cache', () => {
      pool.prepareStatement('SELECT 1');
      pool.prepareStatement('SELECT 2');
      pool.prepareStatement('SELECT 3');

      expect(pool.prepared.size).toBe(3);

      const cleared = pool.clearPreparedCache();
      expect(cleared).toBe(3);
      expect(pool.prepared.size).toBe(0);
    });
  });

  describe('Transactions', () => {
    beforeEach(() => {
      const conn = pool.connections[0];
      conn.db.exec('CREATE TABLE tx_test (id INTEGER, value TEXT)');
    });

    it('should begin transaction', async () => {
      const conn = await pool.beginTransaction();
      expect(conn.inTransaction).toBe(true);
      pool.commitTransaction(conn);
    });

    it('should commit transaction', async () => {
      const conn = await pool.beginTransaction();
      conn.db.prepare('INSERT INTO tx_test VALUES (?, ?)').run(1, 'test');

      const result = pool.commitTransaction(conn);
      expect(result).toBe(true);

      const data = await pool.queryOne('SELECT * FROM tx_test WHERE id = 1');
      expect(data).toBeDefined();
    });

    it('should rollback transaction', async () => {
      const conn = await pool.beginTransaction();
      conn.db.prepare('INSERT INTO tx_test VALUES (?, ?)').run(2, 'test');

      const result = pool.rollbackTransaction(conn);
      expect(result).toBe(true);

      const data = await pool.queryOne('SELECT * FROM tx_test WHERE id = 2');
      expect(data).toBeUndefined();
    });
  });

  describe('Connection Pooling Performance', () => {
    it('should acquire connection < 5ms', async () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const conn = await pool.acquireConnection();
        pool.releaseConnection(conn);
      }
      const duration = performance.now() - start;

      expect(duration / 100).toBeLessThan(5);
    });

    it('should execute query < 10ms', async () => {
      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        await pool.query('SELECT 1');
      }
      const duration = performance.now() - start;

      expect(duration / 50).toBeLessThan(10);
    });

    it('should handle concurrent queries', async () => {
      const start = performance.now();
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(pool.query('SELECT 1'));
      }
      await Promise.all(promises);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500); // All 20 concurrent queries under 500ms
    });

    it('should reduce connection overhead', async () => {
      // Without pooling, each query would require connect/disconnect
      // With pooling, connections are reused

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        await pool.query('SELECT 1');
      }
      const duration = performance.now() - start;

      expect(duration / 100).toBeLessThan(5); // Average < 5ms per query
    });
  });

  describe('Pool Statistics', () => {
    it('should track statistics', async () => {
      const conn = await pool.acquireConnection();
      pool.releaseConnection(conn);

      const stats = pool.getStats();
      expect(stats.created).toBe(5);
      expect(stats.acquired).toBeGreaterThan(0);
      expect(stats.released).toBeGreaterThan(0);
      expect(stats.reused).toBeGreaterThan(0);
    });

    it('should report available connections', async () => {
      const conn = await pool.acquireConnection();
      const stats = pool.getStats();

      expect(stats.availableConnections).toBe(4);
      expect(stats.usedConnections).toBe(1);

      pool.releaseConnection(conn);
    });

    it('should report waiting requests', async () => {
      const conns = [];
      for (let i = 0; i < 5; i++) {
        conns.push(await pool.acquireConnection());
      }

      const promise = pool.acquireConnection();
      let stats = pool.getStats();
      expect(stats.waitingRequests).toBe(1);

      pool.releaseConnection(conns[0]);
      await promise.then(conn => pool.releaseConnection(conn));

      conns.slice(1).forEach(conn => pool.releaseConnection(conn));
    });

    it('should track prepared statements count', () => {
      pool.prepareStatement('SELECT 1');
      pool.prepareStatement('SELECT 2');

      const stats = pool.getStats();
      expect(stats.preparedStatements).toBe(2);
    });
  });

  describe('Health Check', () => {
    it('should perform health check successfully', async () => {
      const health = await pool.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.response).toBeDefined();
    });

    it('should report error on health check failure', async () => {
      await pool.drain();
      pool = new ConnectionPool({
        filename: '/invalid/path/db.sqlite',
        maxConnections: 1,
      });

      await expect(pool.initialize()).rejects.toThrow();
    });
  });

  describe('Vacuum', () => {
    it('should vacuum database', () => {
      const result = pool.vacuum();
      expect(result).toBe(true);
    });
  });

  describe('Pool Draining', () => {
    it('should drain all connections', async () => {
      expect(pool.connections.length).toBe(5);

      await pool.drain();

      expect(pool.connections.length).toBe(0);
      expect(pool.available.length).toBe(0);
      expect(pool.prepared.size).toBe(0);
      expect(pool.waiting.length).toBe(0);
    });

    it('should close idle connections', async () => {
      const conn = await pool.acquireConnection();
      expect(pool.connections.length).toBe(5);

      pool.releaseConnection(conn);
      expect(conn.idleTimer).toBeDefined();

      // Simulate timeout
      clearTimeout(conn.idleTimer);
      pool.closeConnection(conn);

      expect(pool.connections.length).toBe(4);
    });
  });

  describe('Singleton Pattern', () => {
    it('should initialize singleton pool', async () => {
      const pool1 = await initializePool({
        filename: ':memory:',
        maxConnections: 3,
      });

      expect(pool1).toBeDefined();

      const pool2 = getPool();
      expect(pool1).toBe(pool2);

      await pool1.drain();
    });

    it('should throw error if pool not initialized', () => {
      // Reset singleton
      // This would require a way to reset the module state

      expect(() => getPool()).toThrow('Connection pool not initialized');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid acquire/release cycles', async () => {
      for (let i = 0; i < 100; i++) {
        const conn = await pool.acquireConnection();
        pool.releaseConnection(conn);
      }

      expect(pool.stats.acquired).toBeGreaterThan(100);
      expect(pool.stats.released).toBeGreaterThan(100);
    });

    it('should handle concurrent transactions', async () => {
      pool.connections[0].db.exec('CREATE TABLE tx_multi (id INTEGER)');

      const tx1 = await pool.beginTransaction();
      const tx2 = await pool.beginTransaction();

      pool.commitTransaction(tx1);
      pool.commitTransaction(tx2);

      expect(tx1.inTransaction).toBe(false);
      expect(tx2.inTransaction).toBe(false);
    });

    it('should handle connection errors gracefully', async () => {
      const invalidConn = { db: null };
      const result = pool.releaseConnection(invalidConn);
      expect(result).toBe(false);
    });

    it('should track error count', async () => {
      const initialErrors = pool.stats.errors;

      pool.releaseConnection(null);
      pool.releaseConnection(null);

      expect(pool.stats.errors).toBe(initialErrors + 2);
    });
  });
});
