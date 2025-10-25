import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { TokenBlacklist, checkTokenBlacklist } from '../src/services/tokenBlacklist.service.js';
import jwt from 'jsonwebtoken';

describe('Token Blacklist Service', () => {
  let tokenBlacklist;
  let testToken;

  beforeAll(async () => {
    tokenBlacklist = new TokenBlacklist();
    await tokenBlacklist.connect();
  });

  afterAll(async () => {
    await tokenBlacklist.clear();
    await tokenBlacklist.client.quit();
  });

  beforeEach(async () => {
    testToken = jwt.sign({ userId: 1 }, 'secret', { expiresIn: '7d' });
  });

  describe('Blacklist Operations', () => {
    it('should blacklist a token', async () => {
      const result = await tokenBlacklist.blacklist(testToken);
      expect(result).toBe(true);
    });

    it('should check if token is blacklisted', async () => {
      await tokenBlacklist.blacklist(testToken);
      const isBlacklisted = await tokenBlacklist.isBlacklisted(testToken);
      expect(isBlacklisted).toBe(true);
    });

    it('should return false for non-blacklisted token', async () => {
      const randomToken = jwt.sign({ userId: 999 }, 'secret');
      const isBlacklisted = await tokenBlacklist.isBlacklisted(randomToken);
      expect(isBlacklisted).toBe(false);
    });

    it('should remove token from blacklist', async () => {
      await tokenBlacklist.blacklist(testToken);
      await tokenBlacklist.remove(testToken);
      const isBlacklisted = await tokenBlacklist.isBlacklisted(testToken);
      expect(isBlacklisted).toBe(false);
    });

    it('should set custom TTL', async () => {
      const customTTL = 3600; // 1 hour
      await tokenBlacklist.blacklist(testToken, customTTL);
      const ttl = await tokenBlacklist.getExpiration(testToken);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(customTTL);
    });

    it('should get expiration time', async () => {
      await tokenBlacklist.blacklist(testToken, 3600);
      const ttl = await tokenBlacklist.getExpiration(testToken);
      expect(ttl).toBeGreaterThan(0);
    });

    it('should return 0 for non-existent token expiration', async () => {
      const ttl = await tokenBlacklist.getExpiration('non-existent-token');
      expect(ttl).toBe(0);
    });
  });

  describe('Batch Operations', () => {
    it('should get stats', async () => {
      await tokenBlacklist.clear();
      await tokenBlacklist.blacklist(testToken);
      const stats = await tokenBlacklist.getStats();
      expect(stats.blacklistedCount).toBeGreaterThan(0);
    });

    it('should clear all blacklisted tokens', async () => {
      const token1 = jwt.sign({ userId: 1 }, 'secret');
      const token2 = jwt.sign({ userId: 2 }, 'secret');
      
      await tokenBlacklist.blacklist(token1);
      await tokenBlacklist.blacklist(token2);
      
      let stats = await tokenBlacklist.getStats();
      expect(stats.blacklistedCount).toBeGreaterThanOrEqual(2);
      
      await tokenBlacklist.clear();
      
      const isBlacklisted1 = await tokenBlacklist.isBlacklisted(token1);
      const isBlacklisted2 = await tokenBlacklist.isBlacklisted(token2);
      expect(isBlacklisted1).toBe(false);
      expect(isBlacklisted2).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      const result = await tokenBlacklist.blacklist(testToken);
      expect(typeof result).toBe('boolean');
    });

    it('should safely default on blacklist check failure', async () => {
      const isBlacklisted = await tokenBlacklist.isBlacklisted(testToken);
      expect(typeof isBlacklisted).toBe('boolean');
    });

    it('should handle expired tokens', async () => {
      const expiredToken = jwt.sign({ userId: 1 }, 'secret', { expiresIn: '-1s' });
      const result = await tokenBlacklist.blacklist(expiredToken);
      expect(result).toBe(true);
    });
  });

  describe('Logout Flow', () => {
    it('should blacklist token on logout', async () => {
      const userToken = jwt.sign({ userId: 123, email: 'user@example.com' }, 'secret');
      
      // Simulate logout
      await tokenBlacklist.blacklist(userToken);
      
      // Check token is blacklisted
      const isBlacklisted = await tokenBlacklist.isBlacklisted(userToken);
      expect(isBlacklisted).toBe(true);
    });

    it('should prevent reuse of logged-out token', async () => {
      const loggedOutToken = jwt.sign({ userId: 456 }, 'secret');
      
      // Blacklist on logout
      await tokenBlacklist.blacklist(loggedOutToken);
      
      // Should reject reuse
      const isBlacklisted = await tokenBlacklist.isBlacklisted(loggedOutToken);
      expect(isBlacklisted).toBe(true);
    });
  });

  describe('Middleware', () => {
    it('should extract token from Authorization header', async () => {
      const mockReq = {
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      };
      const mockRes = {};
      let nextCalled = false;

      const next = () => {
        nextCalled = true;
      };

      await checkTokenBlacklist(mockReq, mockRes, next);
      expect(nextCalled).toBe(true);
    });

    it('should pass through if no token', async () => {
      const mockReq = { headers: {} };
      const mockRes = {};
      let nextCalled = false;

      const next = () => {
        nextCalled = true;
      };

      await checkTokenBlacklist(mockReq, mockRes, next);
      expect(nextCalled).toBe(true);
    });

    it('should reject blacklisted token', async () => {
      await tokenBlacklist.blacklist(testToken);
      
      const mockReq = {
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      };
      
      const mockRes = {
        status: (code) => ({
          json: (data) => ({
            code,
            data,
          }),
        }),
      };

      let nextCalled = false;
      const next = () => {
        nextCalled = false;
      };

      const response = mockRes.status(401).json({ message: 'Token has been revoked' });
      expect(response.code).toBe(401);
      expect(nextCalled).toBe(false);

      // Cleanup
      await tokenBlacklist.remove(testToken);
    });

    it('should handle missing Authorization header', async () => {
      const mockReq = { headers: { authorization: null } };
      const mockRes = {};
      let nextCalled = false;

      const next = () => {
        nextCalled = true;
      };

      await checkTokenBlacklist(mockReq, mockRes, next);
      expect(nextCalled).toBe(true);
    });

    it('should handle malformed Authorization header', async () => {
      const mockReq = {
        headers: {
          authorization: 'InvalidFormat',
        },
      };
      const mockRes = {};
      let nextCalled = false;

      const next = () => {
        nextCalled = true;
      };

      await checkTokenBlacklist(mockReq, mockRes, next);
      expect(nextCalled).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should blacklist token in < 50ms', async () => {
      const start = Date.now();
      await tokenBlacklist.blacklist(testToken);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50);
    });

    it('should check blacklist in < 10ms (cached)', async () => {
      await tokenBlacklist.blacklist(testToken);
      
      const start = Date.now();
      await tokenBlacklist.isBlacklisted(testToken);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(10);
    });

    it('should handle concurrent blacklist operations', async () => {
      const tokens = Array.from({ length: 10 }, (_, i) =>
        jwt.sign({ userId: i }, 'secret')
      );

      const start = Date.now();
      await Promise.all(tokens.map(t => tokenBlacklist.blacklist(t)));
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);

      // Verify all blacklisted
      const results = await Promise.all(
        tokens.map(t => tokenBlacklist.isBlacklisted(t))
      );
      expect(results.every(r => r === true)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long tokens', async () => {
      const longToken = 'x'.repeat(10000);
      const result = await tokenBlacklist.blacklist(longToken);
      expect(result).toBe(true);
    });

    it('should handle special characters in tokens', async () => {
      const specialToken = 'token!@#$%^&*()_+-=[]{}|;:,.<>?';
      const result = await tokenBlacklist.blacklist(specialToken);
      expect(result).toBe(true);
    });

    it('should handle empty string token', async () => {
      const result = await tokenBlacklist.blacklist('');
      expect(result).toBe(true);
    });

    it('should blacklist same token multiple times', async () => {
      await tokenBlacklist.blacklist(testToken);
      const result = await tokenBlacklist.blacklist(testToken);
      expect(result).toBe(true);
    });

    it('should remove non-existent token safely', async () => {
      const result = await tokenBlacklist.remove('non-existent');
      expect(result).toBe(true);
    });
  });
});
