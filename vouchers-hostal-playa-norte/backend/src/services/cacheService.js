/**
 * Redis Caching Service
 * Cache API responses with configurable TTL
 */

import redis from 'redis';

export class CacheService {
  constructor() {
    this.client = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    
    // Default TTLs by endpoint
    this.ttls = {
      'GET:/vouchers': 300,        // 5 min
      'GET:/orders': 300,          // 5 min
      'GET:/stays': 300,           // 5 min
      'GET:/dashboard': 60,        // 1 min
      'GET:/reports': 600,         // 10 min
      'default': 300,
    };
  }

  async connect() {
    await this.client.connect();
  }

  /**
   * Cache key generator
   */
  generateKey(method, path, userId, params = {}) {
    const paramString = Object.keys(params).length > 0 
      ? `:${JSON.stringify(params)}` 
      : '';
    return `cache:${method}:${path}:${userId}${paramString}`;
  }

  /**
   * Get cached value
   */
  async get(key) {
    try {
      const cached = await this.client.get(key);
      if (cached) {
        console.log(`✅ Cache HIT: ${key}`);
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error(`❌ Cache GET error: ${key}`, error);
      return null;
    }
  }

  /**
   * Set cached value with TTL
   */
  async set(key, value, ttl = 300) {
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      console.log(`💾 Cache SET: ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      console.error(`❌ Cache SET error: ${key}`, error);
      return false;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidate(pattern) {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        console.log(`🗑️ Cache INVALIDATED: ${pattern} (${keys.length} keys)`);
      }
      return keys.length;
    } catch (error) {
      console.error(`❌ Cache INVALIDATE error: ${pattern}`, error);
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clear() {
    try {
      await this.client.flushDb();
      console.log(`🗑️ Cache CLEARED (all)`);
      return true;
    } catch (error) {
      console.error(`❌ Cache CLEAR error`, error);
      return false;
    }
  }

  /**
   * Get cache stats
   */
  async getStats() {
    try {
      const keys = await this.client.keys('cache:*');
      const info = await this.client.info('memory');
      return {
        totalKeys: keys.length,
        memory: info,
      };
    } catch (error) {
      console.error(`❌ Cache STATS error`, error);
      return { totalKeys: 0 };
    }
  }

  /**
   * Get TTL for endpoint
   */
  getTTL(method, path) {
    const key = `${method}:${path}`;
    return this.ttls[key] || this.ttls['default'];
  }

  /**
   * Configure custom TTL
   */
  setTTL(method, path, ttl) {
    const key = `${method}:${path}`;
    this.ttls[key] = ttl;
    console.log(`⚙️ TTL configured: ${key} = ${ttl}s`);
  }
}

export const cacheService = new CacheService();

/**
 * Middleware: Cache GET requests
 */
export const cacheMiddleware = async (req, res, next) => {
  try {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const userId = req.user?.id || 'anonymous';
    const key = cacheService.generateKey(req.method, req.path, userId, req.query);
    
    // Try to get from cache
    const cached = await cacheService.get(key);
    if (cached) {
      return res.json(cached);
    }

    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      // Cache the response
      const ttl = cacheService.getTTL(req.method, req.path);
      cacheService.set(key, data, ttl).catch(err => console.error(err));
      
      // Send response
      return originalJson(data);
    };

    next();
  } catch (error) {
    console.error('❌ Cache middleware error:', error);
    next(); // Continue without caching
  }
};

/**
 * Middleware: Invalidate cache on mutations
 */
export const invalidateCacheMiddleware = async (req, res, next) => {
  try {
    // Only process mutations
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      return next();
    }

    // Store original res.json
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      // Invalidate related caches
      const resourceType = req.path.split('/')[1]; // /vouchers → vouchers
      cacheService.invalidate(`cache:GET:/${resourceType}:*`).catch(err => console.error(err));
      cacheService.invalidate(`cache:GET:/dashboard:*`).catch(err => console.error(err));
      
      return originalJson(data);
    };

    next();
  } catch (error) {
    console.error('❌ Invalidate cache middleware error:', error);
    next();
  }
};

export default cacheService;
