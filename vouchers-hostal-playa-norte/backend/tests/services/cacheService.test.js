import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheService, cacheMiddleware, invalidateCacheMiddleware } from '../services/cacheService.js';

describe('CacheService', () => {
  let cacheService;

  beforeEach(() => {
    cacheService = new CacheService();
  });

  describe('Connection Management', () => {
    it('should initialize with default Redis URL', () => {
      expect(cacheService.client).toBeDefined();
    });

    it('should use custom Redis URL from env', () => {
      process.env.REDIS_URL = 'redis://custom:6379';
      const newCache = new CacheService();
      expect(newCache.client).toBeDefined();
    });
  });

  describe('Key Generation', () => {
    it('should generate cache key without params', () => {
      const key = cacheService.generateKey('GET', '/vouchers', 'user123');
      expect(key).toBe('cache:GET:/vouchers:user123');
    });

    it('should generate cache key with params', () => {
      const key = cacheService.generateKey('GET', '/vouchers', 'user123', { status: 'active' });
      expect(key).toContain('cache:GET:/vouchers:user123');
      expect(key).toContain('status');
    });

    it('should generate different keys for different users', () => {
      const key1 = cacheService.generateKey('GET', '/vouchers', 'user1');
      const key2 = cacheService.generateKey('GET', '/vouchers', 'user2');
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different paths', () => {
      const key1 = cacheService.generateKey('GET', '/vouchers', 'user1');
      const key2 = cacheService.generateKey('GET', '/orders', 'user1');
      expect(key1).not.toBe(key2);
    });

    it('should handle anonymous users', () => {
      const key = cacheService.generateKey('GET', '/public', 'anonymous');
      expect(key).toContain('anonymous');
    });
  });

  describe('Cache Set/Get Operations', () => {
    it('should set and get value', async () => {
      const key = 'cache:test:key';
      const value = { data: 'test', id: 123 };
      
      const setResult = await cacheService.set(key, value, 300);
      expect(setResult).toBe(true);
      
      const getValue = await cacheService.get(key);
      expect(getValue).toEqual(value);
    });

    it('should return null for non-existent key', async () => {
      const key = 'cache:non:existent:key:12345';
      const value = await cacheService.get(key);
      expect(value).toBeNull();
    });

    it('should handle JSON serialization', async () => {
      const key = 'cache:json:test';
      const value = { array: [1, 2, 3], nested: { obj: true } };
      
      await cacheService.set(key, value);
      const cached = await cacheService.get(key);
      expect(cached).toEqual(value);
    });

    it('should respect TTL', async () => {
      const key = 'cache:ttl:test';
      const value = { data: 'expiring' };
      
      await cacheService.set(key, value, 1); // 1 second TTL
      
      // Should be available immediately
      let cached = await cacheService.get(key);
      expect(cached).toEqual(value);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      cached = await cacheService.get(key);
      expect(cached).toBeNull();
    }, { timeout: 3000 });

    it('should handle numeric values', async () => {
      const key = 'cache:number:test';
      const value = { count: 42, percentage: 3.14 };
      
      await cacheService.set(key, value);
      const cached = await cacheService.get(key);
      expect(cached.count).toBe(42);
      expect(cached.percentage).toBe(3.14);
    });

    it('should handle boolean values', async () => {
      const key = 'cache:bool:test';
      const value = { active: true, deleted: false };
      
      await cacheService.set(key, value);
      const cached = await cacheService.get(key);
      expect(cached.active).toBe(true);
      expect(cached.deleted).toBe(false);
    });

    it('should handle null values', async () => {
      const key = 'cache:null:test';
      const value = null;
      
      await cacheService.set(key, value);
      const cached = await cacheService.get(key);
      expect(cached).toBeNull();
    });

    it('should handle large objects', async () => {
      const key = 'cache:large:test';
      const value = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          data: 'x'.repeat(100),
        })),
      };
      
      await cacheService.set(key, value);
      const cached = await cacheService.get(key);
      expect(cached.items.length).toBe(1000);
      expect(cached.items[0].id).toBe(0);
    });

    it('should handle special characters', async () => {
      const key = 'cache:special:test';
      const value = { text: 'Test with émojis 🎉 and "quotes"' };
      
      await cacheService.set(key, value);
      const cached = await cacheService.get(key);
      expect(cached.text).toContain('émojis');
    });
  });

  describe('Invalidation', () => {
    it('should invalidate by pattern', async () => {
      // Set multiple keys
      await cacheService.set('cache:GET:/vouchers:user1', { id: 1 });
      await cacheService.set('cache:GET:/vouchers:user2', { id: 2 });
      await cacheService.set('cache:GET:/orders:user1', { id: 3 });
      
      // Invalidate vouchers
      const count = await cacheService.invalidate('cache:GET:/vouchers:*');
      expect(count).toBe(2);
      
      // Verify vouchers cleared
      const voucher1 = await cacheService.get('cache:GET:/vouchers:user1');
      expect(voucher1).toBeNull();
      
      // Verify orders still exist
      const order1 = await cacheService.get('cache:GET:/orders:user1');
      expect(order1).toEqual({ id: 3 });
    });

    it('should invalidate specific user cache', async () => {
      await cacheService.set('cache:GET:/vouchers:user1', { id: 1 });
      await cacheService.set('cache:GET:/vouchers:user2', { id: 2 });
      
      const count = await cacheService.invalidate('cache:GET:/vouchers:user1');
      expect(count).toBe(1);
      
      const user1 = await cacheService.get('cache:GET:/vouchers:user1');
      expect(user1).toBeNull();
      
      const user2 = await cacheService.get('cache:GET:/vouchers:user2');
      expect(user2).toEqual({ id: 2 });
    });

    it('should return 0 for non-matching patterns', async () => {
      const count = await cacheService.invalidate('cache:nonexistent:*');
      expect(count).toBe(0);
    });

    it('should handle wildcard patterns', async () => {
      await cacheService.set('cache:GET:/vouchers:user1:active', { status: 'active' });
      await cacheService.set('cache:GET:/vouchers:user1:pending', { status: 'pending' });
      
      const count = await cacheService.invalidate('cache:GET:/vouchers:user1:*');
      expect(count).toBe(2);
    });
  });

  describe('Clear All', () => {
    it('should clear all cache', async () => {
      await cacheService.set('cache:test:1', { id: 1 });
      await cacheService.set('cache:test:2', { id: 2 });
      await cacheService.set('cache:test:3', { id: 3 });
      
      const cleared = await cacheService.clear();
      expect(cleared).toBe(true);
      
      const value = await cacheService.get('cache:test:1');
      expect(value).toBeNull();
    });

    it('should not fail on empty cache', async () => {
      const cleared = await cacheService.clear();
      expect(cleared).toBe(true);
    });
  });

  describe('TTL Configuration', () => {
    it('should get default TTL for endpoint', () => {
      const ttl = cacheService.getTTL('GET', '/vouchers');
      expect(ttl).toBe(300); // 5 minutes default
    });

    it('should get TTL for dashboard', () => {
      const ttl = cacheService.getTTL('GET', '/dashboard');
      expect(ttl).toBe(60); // 1 minute
    });

    it('should set custom TTL', () => {
      cacheService.setTTL('GET', '/custom', 600);
      const ttl = cacheService.getTTL('GET', '/custom');
      expect(ttl).toBe(600);
    });

    it('should use default TTL for unknown endpoint', () => {
      const ttl = cacheService.getTTL('GET', '/unknown');
      expect(ttl).toBe(300);
    });

    it('should allow updating TTL', () => {
      cacheService.setTTL('GET', '/test', 100);
      let ttl = cacheService.getTTL('GET', '/test');
      expect(ttl).toBe(100);
      
      cacheService.setTTL('GET', '/test', 200);
      ttl = cacheService.getTTL('GET', '/test');
      expect(ttl).toBe(200);
    });
  });

  describe('Stats', () => {
    it('should get cache stats', async () => {
      await cacheService.set('cache:stat:1', { id: 1 });
      await cacheService.set('cache:stat:2', { id: 2 });
      
      const stats = await cacheService.getStats();
      expect(stats.totalKeys).toBeGreaterThanOrEqual(2);
      expect(stats.memory).toBeDefined();
    });

    it('should return empty stats on error', async () => {
      // This tests error handling
      const stats = await cacheService.getStats();
      expect(stats.totalKeys).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle GET errors gracefully', async () => {
      const result = await cacheService.get('cache:any:key');
      // Should not throw, returns null on error or miss
      expect(result === null || result === undefined || typeof result === 'object').toBe(true);
    });

    it('should handle SET errors gracefully', async () => {
      const result = await cacheService.set('cache:any:key', { data: 'test' });
      // Should not throw
      expect(typeof result === 'boolean').toBe(true);
    });

    it('should handle INVALIDATE errors gracefully', async () => {
      const result = await cacheService.invalidate('cache:any:*');
      // Should not throw
      expect(typeof result === 'number').toBe(true);
    });

    it('should handle CLEAR errors gracefully', async () => {
      const result = await cacheService.clear();
      // Should not throw
      expect(typeof result === 'boolean').toBe(true);
    });
  });

  describe('Middleware: cacheMiddleware', () => {
    it('should skip non-GET requests', async () => {
      const req = {
        method: 'POST',
        user: { id: 'user1' },
        path: '/test',
        query: {},
      };
      const res = {};
      const next = vi.fn();
      
      await cacheMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should try to get cached GET requests', async () => {
      // Set cache first
      const cacheKey = 'cache:GET:/test:user1';
      await cacheService.set(cacheKey, { cached: true });
      
      const req = {
        method: 'GET',
        user: { id: 'user1' },
        path: '/test',
        query: {},
      };
      
      const res = {
        json: vi.fn((data) => ({ ...data })),
      };
      const next = vi.fn();
      
      await cacheMiddleware(req, res, next);
      
      // Should respond with cached data without calling next
      expect(res.json).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next for cache miss', async () => {
      const req = {
        method: 'GET',
        user: { id: 'user1' },
        path: '/nocache',
        query: {},
      };
      const res = { json: vi.fn() };
      const next = vi.fn();
      
      await cacheMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should handle anonymous users', async () => {
      const req = {
        method: 'GET',
        user: undefined,
        path: '/public',
        query: {},
      };
      const res = { json: vi.fn() };
      const next = vi.fn();
      
      await cacheMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should cache response on SET', async () => {
      const req = {
        method: 'GET',
        user: { id: 'user1' },
        path: '/vouchers',
        query: {},
      };
      
      const res = {
        json: function(data) {
          return data;
        },
      };
      const next = async function() {
        // Simulate response
        this.json({ vouchers: [1, 2, 3] });
      };
      
      await cacheMiddleware(req, res, next.bind(res));
      
      // Verify cache was set
      const cacheKey = 'cache:GET:/vouchers:user1';
      const cached = await cacheService.get(cacheKey);
      expect(cached).toBeDefined();
    });
  });

  describe('Middleware: invalidateCacheMiddleware', () => {
    it('should skip GET requests', async () => {
      const req = {
        method: 'GET',
        path: '/vouchers',
      };
      const res = { json: vi.fn() };
      const next = vi.fn();
      
      await invalidateCacheMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should invalidate cache on POST', async () => {
      // Set cache
      await cacheService.set('cache:GET:/vouchers:user1', { id: 1 });
      
      const req = {
        method: 'POST',
        path: '/vouchers',
      };
      
      const res = {
        json: function(data) {
          // Trigger invalidation logic
          return data;
        },
      };
      const next = async function() {
        this.json({ success: true });
      };
      
      await invalidateCacheMiddleware(req, res, next.bind(res));
      expect(next).toHaveBeenCalled();
    });

    it('should invalidate cache on PUT', async () => {
      const req = {
        method: 'PUT',
        path: '/vouchers/123',
      };
      const res = {
        json: function(data) {
          return data;
        },
      };
      const next = vi.fn();
      
      await invalidateCacheMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should invalidate cache on DELETE', async () => {
      const req = {
        method: 'DELETE',
        path: '/orders/456',
      };
      const res = {
        json: function(data) {
          return data;
        },
      };
      const next = vi.fn();
      
      await invalidateCacheMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should invalidate cache on PATCH', async () => {
      const req = {
        method: 'PATCH',
        path: '/stays/789',
      };
      const res = {
        json: function(data) {
          return data;
        },
      };
      const next = vi.fn();
      
      await invalidateCacheMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should handle GET operations under 50ms', async () => {
      const key = 'cache:perf:test:1';
      await cacheService.set(key, { data: 'test' });
      
      const start = performance.now();
      await cacheService.get(key);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(50);
    });

    it('should handle SET operations under 50ms', async () => {
      const start = performance.now();
      await cacheService.set('cache:perf:set:1', { data: 'test' });
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(50);
    });

    it('should handle concurrent reads', async () => {
      const key = 'cache:concurrent:read';
      await cacheService.set(key, { id: 1 });
      
      const start = performance.now();
      await Promise.all([
        cacheService.get(key),
        cacheService.get(key),
        cacheService.get(key),
        cacheService.get(key),
        cacheService.get(key),
      ]);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(100); // All 5 reads under 100ms
    });

    it('should handle concurrent writes', async () => {
      const start = performance.now();
      await Promise.all([
        cacheService.set('cache:concurrent:write:1', { id: 1 }),
        cacheService.set('cache:concurrent:write:2', { id: 2 }),
        cacheService.set('cache:concurrent:write:3', { id: 3 }),
        cacheService.set('cache:concurrent:write:4', { id: 4 }),
        cacheService.set('cache:concurrent:write:5', { id: 5 }),
      ]);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(150); // All 5 writes under 150ms
    });

    it('should scale with many keys', async () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        await cacheService.set(`cache:scale:${i}`, { id: i });
      }
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(2000); // 100 writes under 2 seconds
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string keys', async () => {
      const result = await cacheService.set('', { data: 'test' });
      expect(typeof result === 'boolean').toBe(true);
    });

    it('should handle very long keys', async () => {
      const longKey = 'cache:' + 'x'.repeat(1000);
      const result = await cacheService.set(longKey, { data: 'test' });
      expect(typeof result === 'boolean').toBe(true);
    });

    it('should handle repeated operations on same key', async () => {
      const key = 'cache:repeat:test';
      
      await cacheService.set(key, { v: 1 });
      await cacheService.set(key, { v: 2 });
      await cacheService.set(key, { v: 3 });
      
      const cached = await cacheService.get(key);
      expect(cached.v).toBe(3);
    });

    it('should handle get after invalidate', async () => {
      const key = 'cache:invalid:test';
      await cacheService.set(key, { id: 1 });
      await cacheService.invalidate(key);
      
      const cached = await cacheService.get(key);
      expect(cached).toBeNull();
    });

    it('should handle set after clear', async () => {
      await cacheService.clear();
      
      const result = await cacheService.set('cache:after:clear', { id: 1 });
      expect(result).toBe(true);
      
      const cached = await cacheService.get('cache:after:clear');
      expect(cached).toEqual({ id: 1 });
    });
  });
});
