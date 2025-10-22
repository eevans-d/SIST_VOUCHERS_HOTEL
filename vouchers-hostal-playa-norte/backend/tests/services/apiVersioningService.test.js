import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import APIVersioningService, {
  createVersionedEndpoint,
  migrateRequest,
  checkVersionSupport,
} from '../services/apiVersioningService.js';

describe('APIVersioningService', () => {
  let versioningService;

  beforeEach(() => {
    versioningService = new APIVersioningService({
      currentVersion: '2.0.0',
      supportedVersions: ['1.0.0', '1.5.0', '2.0.0'],
      deprecationWarningDays: 90,
    });
  });

  describe('Version Registration', () => {
    it('should register version', () => {
      versioningService.registerVersion('1.0.0', {});
      expect(versioningService.versionRegistry.has('1.0.0')).toBe(true);
    });

    it('should throw error for invalid version', () => {
      expect(() => {
        versioningService.registerVersion('invalid', {});
      }).toThrow('Invalid semantic version');
    });

    it('should register with handlers', () => {
      const handlers = {
        'GET /orders': vi.fn(),
      };

      versioningService.registerVersion('1.0.0', handlers);
      const registered = versioningService.versionRegistry.get('1.0.0');

      expect(registered.endpoints['GET /orders']).toBeDefined();
    });

    it('should register multiple versions', () => {
      versioningService.registerVersion('1.0.0', {});
      versioningService.registerVersion('2.0.0', {});
      versioningService.registerVersion('3.0.0', {});

      expect(versioningService.versionRegistry.size).toBe(3);
    });
  });

  describe('Version Support', () => {
    it('should check if version supported', () => {
      expect(versioningService.isVersionSupported('1.0.0')).toBe(true);
      expect(versioningService.isVersionSupported('2.0.0')).toBe(true);
    });

    it('should reject unsupported version', () => {
      expect(versioningService.isVersionSupported('3.0.0')).toBe(false);
    });

    it('should reject invalid version', () => {
      expect(versioningService.isVersionSupported('invalid')).toBe(false);
    });

    it('should return current version', () => {
      expect(versioningService.getCurrentVersion()).toBe('2.0.0');
    });
  });

  describe('Version Resolution', () => {
    it('should resolve explicit version', () => {
      const resolved = versioningService.resolveVersion('1.0.0');
      expect(resolved).toBe('1.0.0');
    });

    it('should strip v prefix', () => {
      const resolved = versioningService.resolveVersion('v1.0.0');
      expect(resolved).toBe('1.0.0');
    });

    it('should default to current version', () => {
      const resolved = versioningService.resolveVersion(null);
      expect(resolved).toBe('2.0.0');
    });

    it('should handle semver ranges', () => {
      const resolved = versioningService.resolveVersion('^1.0');
      expect(resolved).toBe('1.5.0'); // Mayor versión que satisface rango
    });

    it('should handle invalid version', () => {
      const resolved = versioningService.resolveVersion('invalid');
      expect(resolved).toBe('2.0.0'); // Default a current
    });

    it('should case-insensitive', () => {
      const resolved = versioningService.resolveVersion('V2.0.0');
      expect(resolved).toBe('2.0.0');
    });
  });

  describe('Deprecation', () => {
    it('should deprecate version', () => {
      const retirementDate = new Date();
      retirementDate.setDate(retirementDate.getDate() + 90);

      versioningService.deprecateVersion('1.0.0', retirementDate, 'Use v2.0.0');

      expect(versioningService.isVersionDeprecated('1.0.0')).toBe(true);
    });

    it('should track deprecation reason', () => {
      const retirementDate = new Date();
      versioningService.deprecateVersion('1.0.0', retirementDate, 'Legacy API');

      const deprecation = versioningService.deprecations.get('1.0.0');
      expect(deprecation.reason).toBe('Legacy API');
    });

    it('should track retirement date', () => {
      const retirementDate = new Date('2025-01-01');
      versioningService.deprecateVersion('1.0.0', retirementDate, 'Retiring');

      const deprecation = versioningService.deprecations.get('1.0.0');
      expect(deprecation.retirementDate).toEqual(new Date('2025-01-01'));
    });

    it('should mark non-deprecated as false', () => {
      expect(versioningService.isVersionDeprecated('2.0.0')).toBe(false);
    });
  });

  describe('Request Migration', () => {
    beforeEach(() => {
      versioningService.registerVersion('1.0.0', {});
      versioningService.registerVersion('2.0.0', {});

      const migrationFn = (body) => versioningService.migrateRequestV1toV2(body);
      versioningService.migrations.set('1.0.0->2.0.0', migrationFn);
    });

    it('should migrate snake_case to camelCase', () => {
      const v1Body = {
        user_id: '123',
        order_date: '2024-01-01',
      };

      const v2Body = versioningService.migrateRequestV1toV2(v1Body);

      expect(v2Body.userId).toBe('123');
      expect(v2Body.orderDate).toBe('2024-01-01');
      expect(v2Body.user_id).toBeUndefined();
      expect(v2Body.order_date).toBeUndefined();
    });

    it('should migrate nested structures', () => {
      const v1Body = {
        price_usd: 99.99,
      };

      const v2Body = versioningService.migrateRequestV1toV2(v1Body);

      expect(v2Body.price).toEqual({
        amount: 99.99,
        currency: 'USD',
      });
      expect(v2Body.price_usd).toBeUndefined();
    });

    it('should preserve unknown fields', () => {
      const v1Body = {
        user_id: '123',
        custom_field: 'value',
      };

      const v2Body = versioningService.migrateRequestV1toV2(v1Body);

      expect(v2Body.custom_field).toBe('value');
    });

    it('should register migration', () => {
      expect(versioningService.migrations.has('1.0.0->2.0.0')).toBe(true);
    });
  });

  describe('Response Migration', () => {
    it('should migrate camelCase to snake_case', () => {
      const v2Response = {
        userId: '123',
        orderDate: '2024-01-01',
      };

      const v1Response = versioningService.migrateResponseV2toV1(v2Response);

      expect(v1Response.user_id).toBe('123');
      expect(v1Response.order_date).toBe('2024-01-01');
      expect(v1Response.userId).toBeUndefined();
    });

    it('should migrate nested price object', () => {
      const v2Response = {
        price: {
          amount: 99.99,
          currency: 'USD',
        },
      };

      const v1Response = versioningService.migrateResponseV2toV1(v2Response);

      expect(v1Response.price_usd).toBe(99.99);
      expect(v1Response.price).toBeUndefined();
    });
  });

  describe('Endpoint Registration', () => {
    it('should register endpoint', () => {
      const handler = vi.fn();
      versioningService.registerEndpoint('1.0.0', 'GET', '/orders', handler);

      expect(versioningService.versionRegistry.has('1.0.0')).toBe(true);
    });

    it('should get endpoint handler', () => {
      const handler = vi.fn();
      versioningService.registerEndpoint('1.0.0', 'GET', '/orders', handler);

      const retrieved = versioningService.getEndpointHandler(
        '1.0.0',
        'GET',
        '/orders'
      );

      expect(retrieved).toBe(handler);
    });

    it('should return null for missing handler', () => {
      const handler = versioningService.getEndpointHandler(
        '2.0.0',
        'GET',
        '/unknown'
      );

      expect(handler).toBeNull();
    });

    it('should support backward compatibility', () => {
      const handler1 = vi.fn();
      versioningService.registerEndpoint('1.0.0', 'GET', '/orders', handler1);

      // v1.5.0 hereda de v1.0.0 si no hay override
      const retrieved = versioningService.getEndpointHandler(
        '1.5.0',
        'GET',
        '/orders'
      );

      expect(retrieved).toBe(handler1);
    });
  });

  describe('Versioned Handler', () => {
    it('should create versioned handler', () => {
      const handlers = {
        '1.0.0': vi.fn().mockImplementation((req, res) => {
          res.json({ version: '1.0.0' });
        }),
        '2.0.0': vi.fn().mockImplementation((req, res) => {
          res.json({ version: '2.0.0' });
        }),
      };

      const handler = versioningService.versionedHandler(handlers);

      expect(typeof handler).toBe('function');
    });

    it('should route to correct handler by version', () => {
      const handlers = {
        '1.0.0': vi.fn(),
        '2.0.0': vi.fn(),
      };

      const handler = versioningService.versionedHandler(handlers);
      const req = { apiVersion: '1.0.0' };
      const res = {};
      const next = vi.fn();

      handler(req, res, next);

      expect(handlers['1.0.0']).toHaveBeenCalledWith(req, res, next);
    });

    it('should use default handler if no version match', () => {
      const defaultHandler = vi.fn();
      const handlers = {
        default: defaultHandler,
      };

      const handler = versioningService.versionedHandler(handlers);
      const req = { apiVersion: '3.0.0' };
      const res = {};

      handler(req, res);

      expect(defaultHandler).toHaveBeenCalled();
    });

    it('should return 501 if no handler', () => {
      const handlers = {};
      const handler = versioningService.versionedHandler(handlers);

      const req = { apiVersion: '1.0.0' };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      handler(req, res);

      expect(res.status).toHaveBeenCalledWith(501);
    });
  });

  describe('Changelog', () => {
    it('should return changelog', () => {
      versioningService.registerVersion('1.0.0', {});
      versioningService.registerVersion('2.0.0', {});

      const changelog = versioningService.getChangelog();

      expect(changelog.current).toBe('2.0.0');
      expect(changelog.supported).toContain('1.0.0');
      expect(changelog.supported).toContain('2.0.0');
    });

    it('should include deprecated versions in changelog', () => {
      const retirementDate = new Date();
      versioningService.deprecateVersion('1.0.0', retirementDate, 'Legacy');

      const changelog = versioningService.getChangelog();

      expect(changelog.deprecated.length).toBeGreaterThan(0);
      expect(changelog.deprecated[0].version).toBe('1.0.0');
    });

    it('should show version status', () => {
      const retirementDate = new Date();
      retirementDate.setDate(retirementDate.getDate() + 90);

      versioningService.registerVersion('1.0.0', {});
      versioningService.registerVersion('2.0.0', {});
      versioningService.deprecateVersion('1.0.0', retirementDate, 'Old');

      const changelog = versioningService.getChangelog();

      const v1 = changelog.versions.find((v) => v.version === '1.0.0');
      const v2 = changelog.versions.find((v) => v.version === '2.0.0');

      expect(v1.status).toBe('deprecated');
      expect(v2.status).toBe('active');
    });
  });

  describe('Statistics', () => {
    it('should return stats', () => {
      const stats = versioningService.getStats();

      expect(stats.registeredVersions).toBeDefined();
      expect(stats.deprecatedVersions).toBeDefined();
      expect(stats.migrationsRegistered).toBeDefined();
      expect(stats.currentVersion).toBe('2.0.0');
    });

    it('should track requests', () => {
      versioningService.stats.requestsV1 = 100;
      versioningService.stats.requestsV2 = 500;

      const stats = versioningService.getStats();

      expect(stats.requestsV1).toBe(100);
      expect(stats.requestsV2).toBe(500);
    });

    it('should track deprecation warnings', () => {
      versioningService.stats.deprecationWarningsSent = 50;

      const stats = versioningService.getStats();

      expect(stats.deprecationWarningsSent).toBe(50);
    });

    it('should track migrations', () => {
      versioningService.stats.migrationsPerformed = 25;

      const stats = versioningService.getStats();

      expect(stats.migrationsPerformed).toBe(25);
    });
  });

  describe('Health Check', () => {
    it('should report healthy', () => {
      const health = versioningService.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.currentVersion).toBe('2.0.0');
      expect(health.timestamp).toBeDefined();
    });

    it('should include supported versions', () => {
      const health = versioningService.healthCheck();

      expect(health.supportedVersions).toContain('1.0.0');
      expect(health.supportedVersions).toContain('2.0.0');
    });
  });

  describe('Helper Functions', () => {
    it('should create versioned endpoint', () => {
      const handlers = {
        '1.0.0': vi.fn(),
        '2.0.0': vi.fn(),
      };

      const endpoint = createVersionedEndpoint(versioningService, handlers);

      expect(typeof endpoint).toBe('function');
    });

    it('should check version support', () => {
      const supported = checkVersionSupport(versioningService, '1.0.0');
      const unsupported = checkVersionSupport(versioningService, '9.0.0');

      expect(supported).toBe(true);
      expect(unsupported).toBe(false);
    });

    it('should migrate request via helper', () => {
      const migration = (body) => ({
        ...body,
        migrated: true,
      });

      versioningService.migrations.set('1.0.0->2.0.0', migration);

      const input = { field: 'value' };
      const output = migrateRequest(versioningService, '1.0.0', '2.0.0', input);

      expect(output.migrated).toBe(true);
    });
  });

  describe('Middleware', () => {
    it('should create detection middleware', () => {
      const middleware = versioningService.versionDetectionMiddleware();

      expect(typeof middleware).toBe('function');
    });

    it('should create rewrite middleware', () => {
      const migration = (body) => ({ ...body });
      const middleware = versioningService.versionRewriteMiddleware(
        '1.0.0',
        '2.0.0',
        migration
      );

      expect(typeof middleware).toBe('function');
    });

    it('should create response normalizer middleware', () => {
      const transform = (data) => data;
      const middleware = versioningService.responseNormalizerMiddleware(
        '1.0.0',
        '2.0.0',
        transform
      );

      expect(typeof middleware).toBe('function');
    });

    it('should create versioned router', () => {
      const router = versioningService.createVersionedRouter();

      expect(router).toBeDefined();
      expect(typeof router.use).toBe('function');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty version string', () => {
      const resolved = versioningService.resolveVersion('');
      expect(resolved).toBe('2.0.0');
    });

    it('should handle multiple v prefixes', () => {
      const resolved = versioningService.resolveVersion('vvv1.0.0');
      // Debería limpiar correctamente o usar current
      expect(resolved).toBeDefined();
    });

    it('should handle null version', () => {
      const resolved = versioningService.resolveVersion(null);
      expect(resolved).toBe('2.0.0');
    });

    it('should handle undefined version', () => {
      const resolved = versioningService.resolveVersion(undefined);
      expect(resolved).toBe('2.0.0');
    });
  });

  describe('Concurrency', () => {
    it('should handle multiple registrations', () => {
      for (let i = 1; i <= 10; i++) {
        versioningService.registerVersion(`${i}.0.0`, {});
      }

      expect(versioningService.versionRegistry.size).toBe(10);
    });

    it('should handle concurrent deprecations', () => {
      const date = new Date();
      for (let i = 1; i <= 5; i++) {
        versioningService.deprecateVersion(`${i}.0.0`, date, `Old v${i}`);
      }

      expect(versioningService.deprecations.size).toBe(5);
    });
  });
});
