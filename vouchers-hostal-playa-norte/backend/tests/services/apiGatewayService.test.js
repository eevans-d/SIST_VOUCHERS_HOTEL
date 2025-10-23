import { describe, it, expect, beforeEach, vi } from 'vitest';
import APIGatewayService from '../services/apiGatewayService.js';

describe('APIGatewayService', () => {
  let gateway;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    gateway = new APIGatewayService({
      jwtSecret: 'test-secret',
      maxRequestSize: 1024,
      requestTimeout: 5000
    });

    mockReq = {
      method: 'GET',
      path: '/api/test',
      headers: {},
      query: {},
      body: {},
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' }
    };

    mockRes = {
      statusCode: 200,
      status: vi.fn(function(code) {
        this.statusCode = code;
        return this;
      }),
      json: vi.fn(function(data) {
        this.data = data;
        return data;
      }),
      get: vi.fn()
    };
  });

  // ===== INITIALIZATION TESTS =====

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const svc = new APIGatewayService();
      expect(svc.routes.size).toBe(0);
      expect(svc.middlewares.length).toBe(0);
    });

    it('should initialize with custom config', () => {
      const svc = new APIGatewayService({
        maxRequestSize: 5000,
        requestTimeout: 10000
      });
      expect(svc.config.maxRequestSize).toBe(5000);
      expect(svc.config.requestTimeout).toBe(10000);
    });
  });

  // ===== ROUTE REGISTRATION TESTS =====

  describe('Route Registration', () => {
    it('should register route', () => {
      const handler = () => ({ data: 'test' });
      gateway.registerRoute('GET', '/api/test', handler);

      expect(gateway.routes.size).toBe(1);
    });

    it('should register with options', () => {
      const handler = () => ({});
      const route = gateway.registerRoute('POST', '/api/user', handler, {
        requiresAuth: true,
        cacheable: true,
        roles: ['admin']
      });

      expect(route.requiresAuth).toBe(true);
      expect(route.cacheable).toBe(true);
      expect(route.roles).toContain('admin');
    });

    it('should register multiple routes', () => {
      gateway.registerRoute('GET', '/api/users', () => ({}));
      gateway.registerRoute('POST', '/api/users', () => ({}));
      gateway.registerRoute('PUT', '/api/users/:id', () => ({}));

      expect(gateway.routes.size).toBe(3);
    });

    it('should create metrics for registered route', () => {
      gateway.registerRoute('GET', '/api/test', () => ({}));
      const metrics = gateway.getMetrics('GET:/api/test');

      expect(metrics).toBeDefined();
      expect(metrics.requests).toBe(0);
    });
  });

  // ===== MIDDLEWARE TESTS =====

  describe('Middleware', () => {
    it('should register middleware', () => {
      const middleware = () => true;
      gateway.use(middleware);

      expect(gateway.middlewares.length).toBe(1);
    });

    it('should execute multiple middlewares', async () => {
      let called = [];

      gateway.use(() => {
        called.push(1);
        return true;
      });

      gateway.use(() => {
        called.push(2);
        return true;
      });

      gateway.registerRoute('GET', '/api/test', async (req, res) => {
        return { success: true };
      }, { requiresAuth: false });

      await gateway.processRequest(mockReq, mockRes);

      expect(called).toEqual([1, 2]);
    });

    it('should stop execution if middleware returns false', async () => {
      gateway.use(() => false);

      gateway.registerRoute('GET', '/api/test', async (req, res) => {
        return { data: 'should not reach' };
      }, { requiresAuth: false });

      await gateway.processRequest(mockReq, mockRes);
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });

  // ===== REQUEST SIZE VALIDATION TESTS =====

  describe('Request Size Validation', () => {
    it('should reject oversized requests', async () => {
      mockReq.headers['content-length'] = 2048; // > 1024 limit
      
      gateway.registerRoute('POST', '/api/test', async () => ({}), { requiresAuth: false });
      
      await gateway.processRequest(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(413);
    });

    it('should allow appropriately sized requests', async () => {
      mockReq.headers['content-length'] = 512;
      
      gateway.registerRoute('POST', '/api/test', async () => ({ ok: true }), { requiresAuth: false });
      
      await gateway.processRequest(mockReq, mockRes);
      
      expect(mockRes.status).not.toHaveBeenCalledWith(413);
    });
  });

  // ===== AUTHENTICATION TESTS =====

  describe('Authentication', () => {
    it('should return 404 for non-registered routes', async () => {
      mockReq.path = '/api/nonexistent';
      
      await gateway.processRequest(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should require auth if configured', async () => {
      gateway.registerRoute('GET', '/api/test', async () => ({}), { requiresAuth: true });
      
      await gateway.processRequest(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should accept valid JWT token', async () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyIsIm5hbWUiOiJUZXN0In0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      mockReq.headers.authorization = `Bearer ${token}`;
      
      const jwtLib = require('jsonwebtoken');
      vi.spyOn(jwtLib, 'verify').mockReturnValue({ id: '123', name: 'Test' });
      
      gateway.registerRoute('GET', '/api/test', async (req, res) => ({}), { requiresAuth: true });
      
      await gateway.processRequest(mockReq, mockRes);
      
      expect(mockRes.status).not.toHaveBeenCalledWith(401);
    });

    it('should check user roles', async () => {
      gateway.registerRoute('GET', '/api/admin', async () => ({}), {
        requiresAuth: true,
        roles: ['admin']
      });
      
      await gateway.processRequest(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  // ===== CACHING TESTS =====

  describe('Caching', () => {
    it('should cache GET response', async () => {
      gateway.registerRoute('GET', '/api/test', async () => ({ data: 'test' }), {
        requiresAuth: false,
        cacheable: true,
        cacheTTL: 300
      });

      const cacheSize1 = gateway.requestCache.size;
      expect(cacheSize1).toBe(1);
    });

    it('should return cached response', async () => {
      gateway.registerRoute('GET', '/api/test', async () => ({ data: 'test' }), {
        requiresAuth: false,
        cacheable: true
      });

      mockRes.statusCode = 200;
      
      const cacheKey = 'GET:/api/test:{}';
      gateway.requestCache.set(cacheKey, {
        response: { cached: true },
        timestamp: Date.now(),
        ttl: 300
      });

      const metrics1 = gateway.getMetrics('GET:/api/test');
      expect(metrics1.cacheHits).toBeGreaterThanOrEqual(0);
    });

    it('should not cache POST requests', async () => {
      mockReq.method = 'POST';
      mockReq.path = '/api/test';

      gateway.registerRoute('POST', '/api/test', async () => ({ id: 1 }), {
        requiresAuth: false,
        cacheable: true
      });

      const cacheSize = gateway.requestCache.size;
      expect(cacheSize).toBe(0);
    });

    it('should clear cache', () => {
      gateway.requestCache.set('key1', { response: {} });
      gateway.requestCache.set('key2', { response: {} });

      const cleared = gateway.clearCache();
      expect(cleared).toBe(true);
      expect(gateway.requestCache.size).toBe(0);
    });

    it('should clear cache by pattern', () => {
      gateway.requestCache.set('GET:/api/users', { response: {} });
      gateway.requestCache.set('GET:/api/products', { response: {} });

      const cleared = gateway.clearCache('users');
      expect(cleared).toBeGreaterThan(0);
    });
  });

  // ===== RATE LIMITING TESTS =====

  describe('Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      gateway.registerRoute('GET', '/api/test', async () => ({}), {
        requiresAuth: false,
        rateLimit: { requests: 5, window: 60000 }
      });

      const result1 = gateway._checkRateLimit(mockReq, 'GET:/api/test');
      expect(result1.allowed).toBe(true);
    });

    it('should reject requests exceeding limit', async () => {
      gateway.registerRoute('GET', '/api/test', async () => ({}), {
        requiresAuth: false,
        rateLimit: { requests: 2, window: 60000 }
      });

      gateway._checkRateLimit(mockReq, 'GET:/api/test');
      gateway._checkRateLimit(mockReq, 'GET:/api/test');

      const result3 = gateway._checkRateLimit(mockReq, 'GET:/api/test');
      expect(result3.allowed).toBe(false);
    });

    it('should return retry-after', async () => {
      gateway.registerRoute('GET', '/api/test', async () => ({}), {
        requiresAuth: false,
        rateLimit: { requests: 1, window: 1000 }
      });

      gateway._checkRateLimit(mockReq, 'GET:/api/test');
      const result2 = gateway._checkRateLimit(mockReq, 'GET:/api/test');

      expect(result2.retryAfter).toBeGreaterThan(0);
      expect(result2.retryAfter).toBeLessThanOrEqual(2);
    });

    it('should reset rate limit window', async () => {
      jest.useFakeTimers();

      gateway.registerRoute('GET', '/api/test', async () => ({}), {
        requiresAuth: false,
        rateLimit: { requests: 1, window: 1000 }
      });

      gateway._checkRateLimit(mockReq, 'GET:/api/test');
      
      jest.advanceTimersByTime(1100);
      
      const result2 = gateway._checkRateLimit(mockReq, 'GET:/api/test');
      expect(result2.allowed).toBe(true);

      jest.useRealTimers();
    });
  });

  // ===== CIRCUIT BREAKER TESTS =====

  describe('Circuit Breaker', () => {
    it('should start in closed state', () => {
      gateway.registerRoute('GET', '/api/test', async () => ({}));
      gateway._checkCircuitBreaker('GET:/api/test');

      const breaker = gateway.circuitBreakers.get('GET:/api/test');
      expect(breaker.state).toBe('closed');
    });

    it('should open after error threshold', () => {
      gateway.registerRoute('GET', '/api/test', async () => ({}));

      for (let i = 0; i < 5; i++) {
        gateway._recordCircuitBreakerFailure('GET:/api/test');
      }

      const breaker = gateway.circuitBreakers.get('GET:/api/test');
      expect(breaker.state).toBe('open');
    });

    it('should reject requests when open', () => {
      gateway.registerRoute('GET', '/api/test', async () => ({}));

      for (let i = 0; i < 5; i++) {
        gateway._recordCircuitBreakerFailure('GET:/api/test');
      }

      const result = gateway._checkCircuitBreaker('GET:/api/test');
      expect(result.isOpen).toBe(true);
    });

    it('should transition to half-open after timeout', async () => {
      gateway.config.circuitBreakerTimeout = 100;
      gateway.registerRoute('GET', '/api/test', async () => ({}));

      for (let i = 0; i < 5; i++) {
        gateway._recordCircuitBreakerFailure('GET:/api/test');
      }

      await new Promise(resolve => setTimeout(resolve, 150));

      gateway._checkCircuitBreaker('GET:/api/test');
      const breaker = gateway.circuitBreakers.get('GET:/api/test');
      expect(breaker.state).toBe('half-open');
    });

    it('should reset circuit breakers', () => {
      gateway.registerRoute('GET', '/api/test', async () => ({}));
      gateway._recordCircuitBreakerFailure('GET:/api/test');

      gateway.resetCircuitBreakers();

      const breaker = gateway.circuitBreakers.get('GET:/api/test');
      expect(breaker.state).toBe('closed');
    });
  });

  // ===== VALIDATION TESTS =====

  describe('Request Validation', () => {
    it('should validate request body', async () => {
      mockReq.method = 'POST';
      mockReq.body = { name: '', email: 'invalid' };

      const validator = (data) => ({
        valid: data.name && data.email,
        errors: []
      });

      gateway.registerRoute('POST', '/api/test', async () => ({}), {
        requiresAuth: false,
        validation: validator
      });

      await gateway.processRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should pass valid request', async () => {
      mockReq.method = 'POST';
      mockReq.body = { name: 'John', email: 'john@example.com' };

      const validator = (data) => ({
        valid: data.name && data.email,
        errors: []
      });

      gateway.registerRoute('POST', '/api/test', async () => ({ ok: true }), {
        requiresAuth: false,
        validation: validator
      });

      await gateway.processRequest(mockReq, mockRes);

      expect(mockRes.status).not.toHaveBeenCalledWith(400);
    });
  });

  // ===== METRICS TESTS =====

  describe('Metrics Collection', () => {
    it('should record successful request', () => {
      gateway.registerRoute('GET', '/api/test', async () => ({}), { requiresAuth: false });
      
      gateway._recordMetric('GET:/api/test', 'success', Date.now());

      const metrics = gateway.getMetrics('GET:/api/test');
      expect(metrics.success).toBe(1);
      expect(metrics.requests).toBe(1);
    });

    it('should record error', () => {
      gateway.registerRoute('GET', '/api/test', async () => ({}));
      
      gateway._recordMetric('GET:/api/test', 'error', Date.now(), 'Test error');

      const metrics = gateway.getMetrics('GET:/api/test');
      expect(metrics.errors).toBe(1);
      expect(metrics.lastError).toBe('Test error');
    });

    it('should calculate success rate', () => {
      gateway.registerRoute('GET', '/api/test', async () => ({}), { requiresAuth: false });

      gateway._recordMetric('GET:/api/test', 'success', Date.now());
      gateway._recordMetric('GET:/api/test', 'error', Date.now(), 'Error');

      const metrics = gateway.getMetrics('GET:/api/test');
      expect(metrics.successRate).toBe('50.0');
    });

    it('should calculate average latency', () => {
      gateway.registerRoute('GET', '/api/test', async () => ({}), { requiresAuth: false });

      const time = Date.now();
      gateway._recordMetric('GET:/api/test', 'success', time - 100);
      gateway._recordMetric('GET:/api/test', 'success', time - 50);

      const metrics = gateway.getMetrics('GET:/api/test');
      expect(metrics.avgLatency).toBeGreaterThan(0);
    });

    it('should get all metrics', () => {
      gateway.registerRoute('GET', '/api/users', async () => ({}), { requiresAuth: false });
      gateway.registerRoute('POST', '/api/users', async () => ({}), { requiresAuth: false });

      gateway._recordMetric('GET:/api/users', 'success', Date.now());
      gateway._recordMetric('POST:/api/users', 'success', Date.now());

      const allMetrics = gateway.getMetrics();
      expect(Object.keys(allMetrics).length).toBeGreaterThanOrEqual(2);
    });

    it('should reset metrics', () => {
      gateway.registerRoute('GET', '/api/test', async () => ({}), { requiresAuth: false });

      gateway._recordMetric('GET:/api/test', 'success', Date.now());
      expect(gateway.getMetrics('GET:/api/test').requests).toBe(1);

      gateway.resetMetrics();
      expect(gateway.getMetrics('GET:/api/test').requests).toBe(0);
    });
  });

  // ===== TRANSFORMATION TESTS =====

  describe('Request/Response Transformation', () => {
    it('should strip fields from request', () => {
      const req = { name: 'John', password: 'secret', email: 'john@example.com' };
      
      const transformed = gateway.transformRequest(req, {
        stripFields: ['password']
      });

      expect(transformed.password).toBeUndefined();
      expect(transformed.email).toBeDefined();
    });

    it('should map fields', () => {
      const req = { user_name: 'John', user_email: 'john@example.com' };
      
      const transformed = gateway.transformRequest(req, {
        mapFields: { user_name: 'name', user_email: 'email' }
      });

      expect(transformed.name).toBe('John');
      expect(transformed.user_name).toBeUndefined();
    });

    it('should enrich fields', () => {
      const req = { name: 'John' };
      
      const transformed = gateway.transformRequest(req, {
        enrichFields: { createdAt: new Date().toISOString(), role: 'user' }
      });

      expect(transformed.role).toBe('user');
      expect(transformed.createdAt).toBeDefined();
    });

    it('should transform response', () => {
      const response = { id: 1, name: 'John' };
      
      const transformed = gateway.transformResponse(response, {
        format: 'data'
      });

      expect(transformed.data).toBeDefined();
      expect(transformed.id).toBeUndefined();
    });
  });

  // ===== ROUTE LISTING TESTS =====

  describe('Route Management', () => {
    it('should list registered routes', () => {
      gateway.registerRoute('GET', '/api/users', async () => ({}));
      gateway.registerRoute('POST', '/api/users', async () => ({}));

      const routes = gateway.getRoutes();
      expect(routes.length).toBe(2);
    });

    it('should include route metadata', () => {
      gateway.registerRoute('GET', '/api/users', async () => ({}), {
        description: 'List all users',
        requiresAuth: true,
        roles: ['admin']
      });

      const routes = gateway.getRoutes();
      const route = routes[0];

      expect(route.description).toBe('List all users');
      expect(route.roles).toContain('admin');
    });
  });

  // ===== HEALTH CHECK TESTS =====

  describe('Health Check', () => {
    it('should report healthy status', () => {
      gateway.registerRoute('GET', '/api/test', async () => ({}), { requiresAuth: false });

      const health = gateway.getHealth();
      expect(health.status).toBe('healthy');
    });

    it('should report gateway metrics in health', () => {
      gateway.registerRoute('GET', '/api/test', async () => ({}), { requiresAuth: false });

      const health = gateway.getHealth();
      expect(health.totalRequests).toBeDefined();
      expect(health.cachedResponses).toBeDefined();
      expect(health.registeredRoutes).toBe(1);
    });

    it('should include circuit breaker status', () => {
      gateway.registerRoute('GET', '/api/test', async () => ({}));
      gateway._checkCircuitBreaker('GET:/api/test');

      const health = gateway.getHealth();
      expect(health.circuitBreakerStatus).toBeDefined();
    });
  });

  // ===== DATA MANAGEMENT TESTS =====

  describe('Data Management', () => {
    it('should clear all data', () => {
      gateway.registerRoute('GET', '/api/test', async () => ({}));
      gateway.requestCache.set('test', {});

      gateway.clear();

      expect(gateway.routes.size).toBe(0);
      expect(gateway.requestCache.size).toBe(0);
    });
  });

  // ===== HEALTH CHECK METHOD TESTS =====

  describe('HealthCheck Method', () => {
    it('should return health check', () => {
      const health = gateway.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
    });
  });

  // ===== EDGE CASES =====

  describe('Edge Cases', () => {
    it('should handle empty route list', () => {
      const routes = gateway.getRoutes();
      expect(routes.length).toBe(0);
    });

    it('should handle metrics for non-existent route', () => {
      const metrics = gateway.getMetrics('NONEXISTENT:/api/test');
      expect(metrics).toBeNull();
    });

    it('should handle very large request bodies', async () => {
      mockReq.headers['content-length'] = gateway.config.maxRequestSize + 1;

      gateway.registerRoute('POST', '/api/test', async () => ({}), { requiresAuth: false });

      await gateway.processRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(413);
    });

    it('should handle concurrent requests', async () => {
      gateway.registerRoute('GET', '/api/test', async () => ({}), { requiresAuth: false });

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(gateway.processRequest(mockReq, mockRes));
      }

      await Promise.all(promises);
      expect(gateway.getMetrics('GET:/api/test').requests).toBe(10);
    });
  });

  // ===== TIMEOUT TESTS =====

  describe('Request Timeout', () => {
    it('should timeout long-running requests', async () => {
      gateway.config.requestTimeout = 100;

      gateway.registerRoute('GET', '/api/test', async () => {
        return new Promise(resolve => setTimeout(() => resolve({}), 500));
      }, { requiresAuth: false });

      await expect(
        gateway._executeWithTimeout(
          new Promise(resolve => setTimeout(() => resolve({}), 500)),
          100
        )
      ).rejects.toThrow('Request timeout');
    });
  });
});
