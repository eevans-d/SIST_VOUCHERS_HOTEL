import redis from 'redis';
import { logger } from '../config/logger.js';

/**
 * TokenBlacklist Service
 * Manages blacklisted JWT tokens using Redis
 */
export class TokenBlacklist {
  constructor() {
    this.client = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    this.ttl = 7 * 24 * 60 * 60; // 7 days
  }

  async connect() {
    await this.client.connect();
  }

  /**
   * Add token to blacklist on logout
   */
  async blacklist(token, expiresIn = this.ttl) {
    try {
      await this.client.setEx(`blacklist:${token}`, expiresIn, 'true');
      logger.info({ event: 'token_blacklisted' });
      return true;
    } catch (error) {
      logger.error({ event: 'token_blacklist_failed', error: error.message, stack: error.stack });
      return false;
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isBlacklisted(token) {
    try {
      const exists = await this.client.exists(`blacklist:${token}`);
      return exists === 1;
    } catch (error) {
      logger.error({ event: 'token_blacklist_check_error', error: error.message, stack: error.stack });
      return false; // Safe default: allow if Redis fails
    }
  }

  /**
   * Remove token from blacklist manually
   */
  async remove(token) {
    try {
      await this.client.del(`blacklist:${token}`);
      return true;
    } catch (error) {
      logger.error({ event: 'token_blacklist_remove_failed', error: error.message, stack: error.stack });
      return false;
    }
  }

  /**
   * Get remaining TTL for token
   */
  async getExpiration(token) {
    try {
      const ttl = await this.client.ttl(`blacklist:${token}`);
      return ttl > 0 ? ttl : 0;
    } catch (error) {
      logger.error({ event: 'token_blacklist_ttl_error', error: error.message, stack: error.stack });
      return 0;
    }
  }

  /**
   * Clear all blacklisted tokens (dangerous!)
   */
  async clear() {
    try {
      const keys = await this.client.keys('blacklist:*');
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info({ event: 'token_blacklist_cleared', count: keys.length });
      }
      return true;
    } catch (error) {
      logger.error({ event: 'token_blacklist_clear_failed', error: error.message, stack: error.stack });
      return false;
    }
  }

  /**
   * Get stats
   */
  async getStats() {
    try {
      const keys = await this.client.keys('blacklist:*');
      return { blacklistedCount: keys.length };
    } catch (error) {
      logger.error({ event: 'token_blacklist_stats_error', error: error.message, stack: error.stack });
      return { blacklistedCount: 0 };
    }
  }
}

export const tokenBlacklist = new TokenBlacklist();

/**
 * Middleware: Check token blacklist
 */
export const checkTokenBlacklist = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return next();
    }

    const isBlacklisted = await tokenBlacklist.isBlacklisted(token);

    if (isBlacklisted) {
      return res.status(401).json({ message: 'Token has been revoked' });
    }

    next();
  } catch (error) {
    logger.error({ event: 'token_blacklist_middleware_error', error: error.message, stack: error.stack });
    next(); // Fail-safe: let request through on error
  }
};

export default tokenBlacklist;
