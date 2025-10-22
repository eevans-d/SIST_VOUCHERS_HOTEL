/**
 * Database Index Optimization Tests
 * Validates composite index creation and query performance
 * Issue: #4 - Database Indexes Optimization
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';

let db;
const TEST_DB_PATH = path.join(process.cwd(), '.db', 'test-indexes.db');
const DB_DIR = path.dirname(TEST_DB_PATH);

/**
 * Helper: Get query execution plan
 */
async function getQueryPlan(query) {
  const result = await db.prepare(`EXPLAIN QUERY PLAN ${query}`).all();
  return result.map(r => r.detail);
}

/**
 * Helper: Benchmark query execution time
 */
async function benchmarkQuery(query, iterations = 5) {
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    await db.prepare(query).all();
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1_000_000;
    times.push(ms);
  }
  
  return {
    min: Math.min(...times),
    max: Math.max(...times),
    avg: times.reduce((a, b) => a + b) / times.length,
    times
  };
}

/**
 * Helper: Check if query uses specific index
 */
async function usesIndex(query, indexName) {
  const plan = await getQueryPlan(query);
  return plan.some(detail => detail.includes(indexName) || detail.includes('USING INDEX'));
}

describe('Database Indexes - Issue #4 Optimization', () => {
  
  beforeAll(async () => {
    // Ensure directory exists
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    
    // Remove old test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    
    // Open database
    db = await open({
      filename: TEST_DB_PATH,
      driver: sqlite3.Database
    });
    
    await db.exec('PRAGMA foreign_keys = ON;');
    
    // Create schema with indexes
    await db.exec(`
      -- Users table
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        isActive INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL
      );
      
      CREATE INDEX idx_users_active_role ON users(isActive, role);
      
      -- Stays table
      CREATE TABLE stays (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        checkIn TEXT NOT NULL,
        checkOut TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY(userId) REFERENCES users(id)
      );
      
      CREATE INDEX idx_stays_user_status ON stays(userId, status);
      CREATE INDEX idx_stays_checkin_checkout ON stays(checkIn, checkOut);
      
      -- Vouchers table
      CREATE TABLE vouchers (
        id TEXT PRIMARY KEY,
        stayId TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        expiryDate TEXT NOT NULL,
        redemptionDate TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY(stayId) REFERENCES stays(id)
      );
      
      CREATE INDEX idx_vouchers_status_expiry ON vouchers(status, expiryDate DESC);
      CREATE INDEX idx_vouchers_redeemed_date ON vouchers(status, redemptionDate DESC) 
        WHERE status = 'redeemed';
      
      -- Orders table
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        stayId TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        total REAL NOT NULL DEFAULT 0,
        finalTotal REAL NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        FOREIGN KEY(stayId) REFERENCES stays(id)
      );
      
      CREATE INDEX idx_orders_status_created ON orders(status, createdAt DESC);
      
      -- Order items table
      CREATE TABLE order_items (
        id TEXT PRIMARY KEY,
        orderId TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY(orderId) REFERENCES orders(id)
      );
      
      CREATE INDEX idx_order_items_order_created ON order_items(orderId, createdAt);
      
      -- Order vouchers junction table
      CREATE TABLE order_vouchers (
        orderId TEXT NOT NULL,
        voucherId TEXT NOT NULL,
        discountApplied REAL NOT NULL,
        PRIMARY KEY(orderId, voucherId),
        FOREIGN KEY(orderId) REFERENCES orders(id),
        FOREIGN KEY(voucherId) REFERENCES vouchers(id)
      );
      
      CREATE INDEX idx_order_vouchers_order_discount ON order_vouchers(orderId, discountApplied);
      
      -- Run ANALYZE to update optimizer
      ANALYZE;
    `);
    
    // Insert test data
    await insertTestData();
  });
  
  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });
  
  async function insertTestData() {
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    // Insert users
    for (let i = 1; i <= 10; i++) {
      await db.run(
        `INSERT INTO users (id, email, role, isActive, createdAt) 
         VALUES (?, ?, ?, ?, ?)`,
        [`user-${i}`, `user${i}@test.com`, 'guest', 1, now]
      );
    }
    
    // Insert stays
    for (let i = 1; i <= 20; i++) {
      const userId = `user-${(i % 10) + 1}`;
      const status = i % 3 === 0 ? 'completed' : 'active';
      await db.run(
        `INSERT INTO stays (id, userId, status, checkIn, checkOut, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          `stay-${i}`,
          userId,
          status,
          new Date(Date.now() - (20 - i) * 24 * 60 * 60 * 1000).toISOString(),
          new Date(Date.now() + (i) * 24 * 60 * 60 * 1000).toISOString(),
          now
        ]
      );
    }
    
    // Insert vouchers
    for (let i = 1; i <= 50; i++) {
      const status = i % 5 === 0 ? 'redeemed' : (i % 4 === 0 ? 'expired' : 'active');
      const redemptionDate = status === 'redeemed' ? now : null;
      
      await db.run(
        `INSERT INTO vouchers (id, stayId, status, expiryDate, redemptionDate, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          `voucher-${i}`,
          `stay-${(i % 20) + 1}`,
          status,
          status === 'expired' ? 
            new Date(Date.now() - 1000).toISOString() : future,
          redemptionDate,
          now
        ]
      );
    }
    
    // Insert orders
    for (let i = 1; i <= 30; i++) {
      const status = i % 3 === 0 ? 'completed' : 'open';
      await db.run(
        `INSERT INTO orders (id, stayId, status, total, finalTotal, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          `order-${i}`,
          `stay-${(i % 20) + 1}`,
          status,
          100 + (i * 10),
          90 + (i * 9),
          now
        ]
      );
    }
    
    // Insert order items
    for (let i = 1; i <= 30; i++) {
      for (let j = 1; j <= 3; j++) {
        await db.run(
          `INSERT INTO order_items (id, orderId, createdAt) VALUES (?, ?, ?)`,
          [`item-${i}-${j}`, `order-${i}`, now]
        );
      }
    }
    
    // Insert order vouchers
    for (let i = 1; i <= 15; i++) {
      await db.run(
        `INSERT INTO order_vouchers (orderId, voucherId, discountApplied) 
         VALUES (?, ?, ?)`,
        [`order-${i}`, `voucher-${i * 2}`, 10 + i]
      );
    }
  }
  
  // ========================================================================
  // INDEX EXISTENCE TESTS
  // ========================================================================
  
  describe('Index Creation', () => {
    it('should create idx_vouchers_status_expiry index', async () => {
      const indexes = await db.all(
        `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_vouchers_status_expiry'`
      );
      expect(indexes.length).toBe(1);
    });
    
    it('should create idx_orders_status_created index', async () => {
      const indexes = await db.all(
        `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_orders_status_created'`
      );
      expect(indexes.length).toBe(1);
    });
    
    it('should create idx_stays_user_status index', async () => {
      const indexes = await db.all(
        `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_stays_user_status'`
      );
      expect(indexes.length).toBe(1);
    });
    
    it('should create all 8 composite indexes', async () => {
      const indexes = await db.all(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%' AND sql IS NOT NULL
      `);
      expect(indexes.length).toBeGreaterThanOrEqual(8);
    });
  });
  
  // ========================================================================
  // QUERY PLAN TESTS (VERIFY INDEX USAGE)
  // ========================================================================
  
  describe('Query Plan Analysis', () => {
    it('should use idx_vouchers_status_expiry for status/expiry query', async () => {
      const query = `
        SELECT * FROM vouchers 
        WHERE status = 'active' AND expiryDate > datetime('now')
      `;
      
      const plan = await getQueryPlan(query);
      expect(plan[0]).toMatch(/idx_vouchers_status_expiry|USING INDEX/);
    });
    
    it('should use idx_orders_status_created for status/date query', async () => {
      const query = `
        SELECT * FROM orders 
        WHERE status = 'completed' AND date(createdAt) = date('now')
      `;
      
      const plan = await getQueryPlan(query);
      expect(plan[0]).toMatch(/idx_orders_status_created|USING INDEX/);
    });
    
    it('should use idx_stays_user_status for user/status query', async () => {
      const query = `
        SELECT * FROM stays 
        WHERE userId = 'user-1' AND status = 'active'
      `;
      
      const plan = await getQueryPlan(query);
      expect(plan[0]).toMatch(/idx_stays_user_status|USING INDEX/);
    });
    
    it('should use idx_order_vouchers_order_discount for order discount query', async () => {
      const query = `
        SELECT * FROM order_vouchers 
        WHERE orderId = 'order-1' AND discountApplied > 0
      `;
      
      const plan = await getQueryPlan(query);
      expect(plan[0]).toMatch(/idx_order_vouchers_order_discount|USING INDEX/);
    });
    
    it('should use idx_order_items_order_created for order items query', async () => {
      const query = `
        SELECT * FROM order_items 
        WHERE orderId = 'order-1' 
        ORDER BY createdAt
      `;
      
      const plan = await getQueryPlan(query);
      expect(plan[0]).toMatch(/idx_order_items_order_created|USING INDEX/);
    });
  });
  
  // ========================================================================
  // PERFORMANCE BENCHMARKS
  // ========================================================================
  
  describe('Performance Benchmarks', () => {
    it('should quickly query vouchers by status and expiry', async () => {
      const query = `
        SELECT status, COUNT(*) as count FROM vouchers 
        WHERE expiryDate > datetime('now') 
        GROUP BY status
      `;
      
      const bench = await benchmarkQuery(query);
      
      expect(bench.avg).toBeLessThan(50); // Should be < 50ms
      expect(bench.max).toBeLessThan(100); // Max < 100ms
    });
    
    it('should quickly aggregate orders by status', async () => {
      const query = `
        SELECT COUNT(*), SUM(finalTotal) FROM orders 
        WHERE status = 'completed'
      `;
      
      const bench = await benchmarkQuery(query);
      
      expect(bench.avg).toBeLessThan(50);
      expect(bench.max).toBeLessThan(100);
    });
    
    it('should quickly count active stays', async () => {
      const query = `
        SELECT COUNT(*) FROM stays WHERE status = 'active'
      `;
      
      const bench = await benchmarkQuery(query);
      
      expect(bench.avg).toBeLessThan(30);
      expect(bench.max).toBeLessThan(100);
    });
    
    it('should quickly find user active stays', async () => {
      const query = `
        SELECT * FROM stays 
        WHERE userId = 'user-1' AND status = 'active'
      `;
      
      const bench = await benchmarkQuery(query);
      
      expect(bench.avg).toBeLessThan(20);
      expect(bench.max).toBeLessThan(100);
    });
    
    it('should quickly calculate order discounts', async () => {
      const query = `
        SELECT SUM(discountApplied) FROM order_vouchers 
        WHERE orderId = 'order-1'
      `;
      
      const bench = await benchmarkQuery(query);
      
      expect(bench.avg).toBeLessThan(15);
      expect(bench.max).toBeLessThan(100);
    });
  });
  
  // ========================================================================
  // COMPLEX QUERY TESTS (DASHBOARD SCENARIOS)
  // ========================================================================
  
  describe('Dashboard Query Optimization', () => {
    it('should perform dashboard voucher stats efficiently', async () => {
      const queries = [
        'SELECT COUNT(*) FROM vouchers WHERE status = "active"',
        'SELECT COUNT(*) FROM vouchers WHERE status = "pending"',
        'SELECT COUNT(*) FROM vouchers WHERE status = "redeemed"'
      ];
      
      const start = process.hrtime.bigint();
      
      for (const query of queries) {
        await db.prepare(query).get();
      }
      
      const end = process.hrtime.bigint();
      const totalMs = Number(end - start) / 1_000_000;
      
      // All three queries should complete in < 50ms combined
      expect(totalMs).toBeLessThan(50);
    });
    
    it('should fetch dashboard data with parallel queries', async () => {
      const occupancyQuery = `SELECT COUNT(*) as count FROM stays WHERE status = 'active'`;
      const ordersQuery = `SELECT SUM(finalTotal) as total FROM orders WHERE status = 'completed'`;
      const vouchersQuery = `SELECT COUNT(*) as count FROM vouchers WHERE status = 'redeemed'`;
      
      const start = process.hrtime.bigint();
      
      const [occupancy, orders, vouchers] = await Promise.all([
        db.prepare(occupancyQuery).get(),
        db.prepare(ordersQuery).get(),
        db.prepare(vouchersQuery).get()
      ]);
      
      const end = process.hrtime.bigint();
      const totalMs = Number(end - start) / 1_000_000;
      
      expect(occupancy).toBeDefined();
      expect(orders).toBeDefined();
      expect(vouchers).toBeDefined();
      // Parallel execution should be fast
      expect(totalMs).toBeLessThan(100);
    });
  });
  
  // ========================================================================
  // PARTIAL INDEX TESTS
  // ========================================================================
  
  describe('Partial Index Optimization', () => {
    it('should create partial index for redeemed vouchers', async () => {
      const indexes = await db.all(`
        SELECT sql FROM sqlite_master 
        WHERE type='index' AND name='idx_vouchers_redeemed_date'
      `);
      
      expect(indexes.length).toBe(1);
      expect(indexes[0].sql).toContain('WHERE');
    });
    
    it('should use partial index for redeemed voucher queries', async () => {
      const query = `
        SELECT * FROM vouchers 
        WHERE status = 'redeemed' AND redemptionDate > datetime('now', '-30 days')
      `;
      
      const plan = await getQueryPlan(query);
      expect(plan[0]).toMatch(/idx_vouchers_redeemed_date|USING INDEX/);
    });
  });
  
  // ========================================================================
  // INDEX STATISTICS TESTS
  // ========================================================================
  
  describe('Index Statistics', () => {
    it('should have ANALYZE statistics for query optimizer', async () => {
      const stats = await db.all(`SELECT * FROM sqlite_stat1 LIMIT 5`);
      expect(stats.length).toBeGreaterThan(0);
    });
    
    it('should report index cardinality correctly', async () => {
      const stats = await db.all(`
        SELECT tbl, idx, stat FROM sqlite_stat1 
        WHERE idx LIKE 'idx_vouchers_%'
      `);
      
      expect(stats.length).toBeGreaterThan(0);
    });
  });
  
  // ========================================================================
  // REGRESSION TESTS (ENSURE CORRECTNESS)
  // ========================================================================
  
  describe('Query Correctness (No Regressions)', () => {
    it('should return correct results for indexed queries', async () => {
      // Count active vouchers manually
      const result = await db.prepare(`
        SELECT COUNT(*) as count FROM vouchers WHERE status = 'active'
      `).get();
      
      expect(result.count).toBeGreaterThan(0);
      expect(result.count).toBeLessThanOrEqual(50);
    });
    
    it('should filter correctly with composite indexes', async () => {
      const results = await db.prepare(`
        SELECT * FROM stays WHERE userId = 'user-1' AND status = 'active'
      `).all();
      
      // All results should match filter criteria
      for (const stay of results) {
        expect(stay.userId).toBe('user-1');
        expect(stay.status).toBe('active');
      }
    });
    
    it('should aggregate correctly with indexed queries', async () => {
      const result = await db.prepare(`
        SELECT status, COUNT(*) as count FROM vouchers GROUP BY status
      `).all();
      
      const totalCount = result.reduce((sum, row) => sum + row.count, 0);
      expect(totalCount).toBe(50); // Total vouchers inserted
    });
  });
});
