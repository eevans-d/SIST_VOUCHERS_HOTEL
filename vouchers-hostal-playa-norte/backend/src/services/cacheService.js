/* eslint-disable indent */
/**
 * Redis Caching Service
 * Cache API responses with configurable TTL
 */

import redis from 'redis';
import { logger } from '../config/logger.js';

export class CacheService {
  constructor() {
    this.client = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    // Default TTLs by endpoint
    this.ttls = {
      'GET:/vouchers': 300, // 5 min
      'GET:/orders': 300, // 5 min
      'GET:/stays': 300, // 5 min
      'GET:/dashboard': 60, // 1 min
      'GET:/reports': 600, // 10 min
      default: 300
    };
  }

  async connect() {
    await this.client.connect();
  }

  /**
   * Cache key generator
   */
  generateKey(method, path, userId, params = {}) {
    const paramString =
      Object.keys(params).length > 0 ? `:${JSON.stringify(params)}` : '';
    return `cache:${method}:${path}:${userId}${paramString}`;
  }

  /**
   * Get cached value
   */
  async get(key) {
    try {
      const cached = await this.client.get(key);
      if (cached) {
        logger.debug({ event: 'cache_hit', key });
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.error({ event: 'cache_get_error', key, error: error.message, stack: error.stack });
      return null;
    }
  }

  /**
   * Set cached value with TTL
   */
  async set(key, value, ttl = 300) {
    try {
  await this.client.setEx(key, ttl, JSON.stringify(value));
  logger.debug({ event: 'cache_set', key, ttl });
      return true;
    } catch (error) {
      logger.error({ event: 'cache_set_error', key, error: error.message, stack: error.stack });
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
        logger.info({ event: 'cache_invalidated', pattern, count: keys.length });
      }
      return keys.length;
    } catch (error) {
      logger.error({ event: 'cache_invalidate_error', pattern, error: error.message, stack: error.stack });
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clear() {
    try {
  await this.client.flushDb();
  logger.info({ event: 'cache_cleared_all' });
      return true;
    } catch (error) {
      logger.error({ event: 'cache_clear_error', error: error.message, stack: error.stack });
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
        memory: info
      };
    } catch (error) {
      logger.error({ event: 'cache_stats_error', error: error.message, stack: error.stack });
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
  logger.info({ event: 'cache_ttl_configured', endpoint: key, ttl });
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
    const key = cacheService.generateKey(
      req.method,
      req.path,
      userId,
      req.query
    );

    // Try to get from cache
    const cached = await cacheService.get(key);
    if (cached) {
      return res.json(cached);
    }

    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      // Cache the response
      const ttl = cacheService.getTTL(req.method, req.path);
    cacheService.set(key, data, ttl).catch((err) => logger.error({ event: 'cache_set_middleware_error', key, error: err.message, stack: err.stack }));

      // Send response
      return originalJson(data);
    };

    next();
  } catch (error) {
    logger.error({ event: 'cache_middleware_error', error: error.message, stack: error.stack });
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
    res.json = function (data) {
      // Invalidate related caches
      const resourceType = req.path.split('/')[1]; // /vouchers → vouchers
      cacheService
        .invalidate(`cache:GET:/${resourceType}:*`)
        .catch((err) => logger.error({ event: 'cache_invalidate_related_error', resourceType, error: err.message, stack: err.stack }));
      cacheService
        .invalidate('cache:GET:/dashboard:*')
        .catch((err) => logger.error({ event: 'cache_invalidate_dashboard_error', error: err.message, stack: err.stack }));

      return originalJson(data);
    };

    next();
  } catch (error) {
    logger.error({ event: 'cache_invalidate_middleware_error', error: error.message, stack: error.stack });
    next();
  }
};

export default cacheService;
