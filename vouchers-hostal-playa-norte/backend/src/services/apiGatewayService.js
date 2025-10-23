/**
 * API Gateway Service
 * Centralized request/response handling, routing, authentication,
 * rate limiting, caching, and monitoring for all API endpoints
 */

import jwt from 'jsonwebtoken';

class APIGatewayService {
  constructor(config = {}) {
    this.config = {
      jwtSecret: config.jwtSecret || process.env.JWT_SECRET || 'secret',
      maxRequestSize: config.maxRequestSize || 10 * 1024 * 1024, // 10MB
      requestTimeout: config.requestTimeout || 30000, // 30s
      enableCaching: config.enableCaching !== false,
      enableCompression: config.enableCompression !== false,
      enableRateLimit: config.enableRateLimit !== false,
      enableCircuitBreaker: config.enableCircuitBreaker !== false,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 50, // 50% error rate
      circuitBreakerTimeout: config.circuitBreakerTimeout || 60000, // 60s
      ...config
    };

    this.routes = new Map();
    this.middlewares = [];
    this.requestCache = new Map();
    this.requestMetrics = new Map();
    this.circuitBreakers = new Map();
    this.requestQueue = new Map();
  }

  /**
   * Register API route
   */
  registerRoute(method, path, handler, options = {}) {
    const route = {
      method: method.toUpperCase(),
      path,
      handler,
      requiresAuth: options.requiresAuth !== false,
      cacheable: options.cacheable === true,
      cacheTTL: options.cacheTTL || 300,
      rateLimit: options.rateLimit || { requests: 100, window: 60000 },
      timeout: options.timeout || this.config.requestTimeout,
      roles: options.roles || [],
      validation: options.validation || null,
      description: options.description || ''
    };

    const key = `${method.toUpperCase()}:${path}`;
    this.routes.set(key, route);

    if (!this.requestMetrics.has(key)) {
      this.requestMetrics.set(key, {
        requests: 0,
        success: 0,
        errors: 0,
        avgLatency: 0,
        lastError: null,
        cacheHits: 0,
        cacheMisses: 0
      });
    }

    return route;
  }

  /**
   * Register global middleware
   */
  use(middleware) {
    this.middlewares.push(middleware);
  }

  /**
   * Process incoming request
   */
  async processRequest(req, res) {
    const startTime = Date.now();
    const routeKey = `${req.method}:${req.path}`;

    try {
      // Validate request size
      if (req.headers['content-length'] > this.config.maxRequestSize) {
        return res.status(413).json({
          error: 'Payload too large',
          maxSize: this.config.maxRequestSize
        });
      }

      // Find matching route
      const route = this.routes.get(routeKey);
      if (!route) {
        return res.status(404).json({ error: 'Route not found' });
      }

      // Execute middlewares
      for (const middleware of this.middlewares) {
        const result = await middleware(req, res);
        if (result === false) return;
      }

      // Authenticate
      if (route.requiresAuth) {
        const authResult = await this._authenticate(req, route);
        if (!authResult.valid) {
          return res.status(401).json({ error: authResult.error });
        }
        req.user = authResult.user;
      }

      // Check cache
      if (route.cacheable && req.method === 'GET') {
        const cached = this._getCachedResponse(routeKey, req);
        if (cached) {
          this._recordMetric(routeKey, 'cacheHit', startTime);
          return res.status(200).json(cached);
        }
      }

      // Rate limiting
      if (this.config.enableRateLimit) {
        const rateLimitResult = this._checkRateLimit(req, routeKey);
        if (!rateLimitResult.allowed) {
          return res.status(429).json({
            error: 'Too many requests',
            retryAfter: rateLimitResult.retryAfter
          });
        }
      }

      // Circuit breaker
      if (this.config.enableCircuitBreaker) {
        const cbResult = this._checkCircuitBreaker(routeKey);
        if (cbResult.isOpen) {
          return res.status(503).json({
            error: 'Service temporarily unavailable',
            retryAfter: cbResult.retryAfter
          });
        }
      }

      // Validate request
      if (route.validation && req.body) {
        const validationResult = route.validation(req.body);
        if (!validationResult.valid) {
          return res.status(400).json({
            error: 'Validation failed',
            details: validationResult.errors
          });
        }
      }

      // Execute handler
      const response = await this._executeWithTimeout(
        route.handler(req, res),
        route.timeout
      );

      // Cache response
      if (route.cacheable && response && res.statusCode === 200) {
        this._cacheResponse(routeKey, req, response, route.cacheTTL);
        this._recordMetric(routeKey, 'cacheMiss', startTime);
      }

      this._recordMetric(routeKey, 'success', startTime);

      return response;

    } catch (error) {
      this._recordMetric(routeKey, 'error', startTime, error.message);
      this._recordCircuitBreakerFailure(routeKey);

      return res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Authenticate request
   * @private
   */
  async _authenticate(req, route) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { valid: false, error: 'Missing authorization header' };
    }

    const token = authHeader.slice(7);

    try {
      const decoded = jwt.verify(token, this.config.jwtSecret);

      // Check roles
      if (route.roles.length > 0) {
        const userRoles = decoded.roles || [];
        const hasRole = route.roles.some(r => userRoles.includes(r));

        if (!hasRole) {
          return { valid: false, error: 'Insufficient permissions' };
        }
      }

      return { valid: true, user: decoded };

    } catch (error) {
      return { valid: false, error: 'Invalid token' };
    }
  }

  /**
   * Get cached response
   * @private
   */
  _getCachedResponse(routeKey, req) {
    const cacheKey = this._generateCacheKey(routeKey, req);
    const cached = this.requestCache.get(cacheKey);

    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl * 1000) {
      this.requestCache.delete(cacheKey);
      return null;
    }

    return cached.response;
  }

  /**
   * Cache response
   * @private
   */
  _cacheResponse(routeKey, req, response, ttl) {
    const cacheKey = this._generateCacheKey(routeKey, req);
    this.requestCache.set(cacheKey, {
      response,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Generate cache key
   * @private
   */
  _generateCacheKey(routeKey, req) {
    const queryString = JSON.stringify(req.query || {});
    return `${routeKey}:${queryString}`;
  }

  /**
   * Check rate limit
   * @private
   */
  _checkRateLimit(req, routeKey) {
    const clientId = req.ip || req.connection.remoteAddress;
    const key = `${routeKey}:${clientId}`;

    if (!this.requestQueue.has(key)) {
      this.requestQueue.set(key, {
        requests: [],
        window: Date.now()
      });
    }

    const bucket = this.requestQueue.get(key);
    const now = Date.now();
    const route = this.routes.get(routeKey);
    const { requests: limit, window } = route.rateLimit;

    bucket.requests = bucket.requests.filter(t => now - t < window);

    if (bucket.requests.length >= limit) {
      const oldestRequest = Math.min(...bucket.requests);
      const retryAfter = Math.ceil((oldestRequest + window - now) / 1000);

      return { allowed: false, retryAfter };
    }

    bucket.requests.push(now);

    return { allowed: true };
  }

  /**
   * Check circuit breaker
   * @private
   */
  _checkCircuitBreaker(routeKey) {
    if (!this.circuitBreakers.has(routeKey)) {
      this.circuitBreakers.set(routeKey, {
        state: 'closed',
        failures: 0,
        successes: 0,
        lastFailureTime: null,
        openedAt: null
      });
    }

    const breaker = this.circuitBreakers.get(routeKey);

    if (breaker.state === 'open') {
      const timeSinceOpen = Date.now() - breaker.openedAt;
      if (timeSinceOpen > this.config.circuitBreakerTimeout) {
        breaker.state = 'half-open';
        breaker.successes = 0;
      } else {
        const retryAfter = Math.ceil(
          (breaker.openedAt + this.config.circuitBreakerTimeout - Date.now()) / 1000
        );
        return { isOpen: true, retryAfter };
      }
    }

    return { isOpen: false };
  }

  /**
   * Record circuit breaker failure
   * @private
   */
  _recordCircuitBreakerFailure(routeKey) {
    if (!this.circuitBreakers.has(routeKey)) return;

    const breaker = this.circuitBreakers.get(routeKey);
    breaker.failures += 1;
    breaker.lastFailureTime = Date.now();

    const total = breaker.failures + breaker.successes;
    const errorRate = (breaker.failures / total) * 100;

    if (errorRate > this.config.circuitBreakerThreshold && total >= 5) {
      breaker.state = 'open';
      breaker.openedAt = Date.now();
    }
  }

  /**
   * Execute with timeout
   * @private
   */
  async _executeWithTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      )
    ]);
  }

  /**
   * Record metric
   * @private
   */
  _recordMetric(routeKey, type, startTime, error = null) {
    if (!this.requestMetrics.has(routeKey)) {
      this.requestMetrics.set(routeKey, {
        requests: 0,
        success: 0,
        errors: 0,
        avgLatency: 0,
        lastError: null,
        cacheHits: 0,
        cacheMisses: 0
      });
    }

    const metrics = this.requestMetrics.get(routeKey);
    const latency = Date.now() - startTime;

    metrics.requests += 1;

    if (type === 'success') {
      metrics.success += 1;
      metrics.avgLatency = (metrics.avgLatency * (metrics.success - 1) + latency) / metrics.success;
    } else if (type === 'error') {
      metrics.errors += 1;
      metrics.lastError = error;
    } else if (type === 'cacheHit') {
      metrics.cacheHits += 1;
    } else if (type === 'cacheMiss') {
      metrics.cacheMisses += 1;
    }
  }

  /**
   * Get metrics
   */
  getMetrics(routeKey) {
    if (routeKey) {
      return this.requestMetrics.get(routeKey) || null;
    }

    const allMetrics = {};
    for (const [key, metrics] of this.requestMetrics) {
      allMetrics[key] = {
        ...metrics,
        successRate: metrics.requests > 0 ? (metrics.success / metrics.requests * 100).toFixed(1) : 0,
        errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests * 100).toFixed(1) : 0,
        cacheHitRate: (metrics.cacheHits + metrics.cacheMisses) > 0
          ? (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) * 100).toFixed(1)
          : 0
      };
    }

    return allMetrics;
  }

  /**
   * Get routes
   */
  getRoutes() {
    const routes = [];
    for (const [key, route] of this.routes) {
      routes.push({
        key,
        method: route.method,
        path: route.path,
        requiresAuth: route.requiresAuth,
        cacheable: route.cacheable,
        description: route.description,
        roles: route.roles
      });
    }
    return routes;
  }

  /**
   * Clear cache
   */
  clearCache(pattern = null) {
    if (!pattern) {
      this.requestCache.clear();
      return this.requestCache.size === 0;
    }

    let cleared = 0;
    for (const [key] of this.requestCache) {
      if (key.includes(pattern)) {
        this.requestCache.delete(key);
        cleared += 1;
      }
    }

    return cleared;
  }

  /**
   * Get gateway health
   */
  getHealth() {
    const metrics = this.getMetrics();
    let totalRequests = 0;
    let totalErrors = 0;
    let totalCacheHits = 0;

    for (const key in metrics) {
      totalRequests += metrics[key].requests;
      totalErrors += metrics[key].errors;
      totalCacheHits += metrics[key].cacheHits;
    }

    const avgErrorRate = totalRequests > 0 ? (totalErrors / totalRequests * 100).toFixed(1) : 0;

    return {
      status: avgErrorRate > 10 ? 'degraded' : 'healthy',
      totalRequests,
      totalErrors,
      errorRate: avgErrorRate,
      cachedResponses: this.requestCache.size,
      totalCacheHits,
      circuitBreakerStatus: Object.fromEntries(this.circuitBreakers),
      registeredRoutes: this.routes.size
    };
  }

  /**
   * Transform request
   */
  transformRequest(req, transformConfig) {
    const transformed = { ...req };

    if (transformConfig.stripFields) {
      for (const field of transformConfig.stripFields) {
        delete transformed[field];
      }
    }

    if (transformConfig.mapFields) {
      for (const [from, to] of Object.entries(transformConfig.mapFields)) {
        if (transformed[from] !== undefined) {
          transformed[to] = transformed[from];
          delete transformed[from];
        }
      }
    }

    if (transformConfig.enrichFields) {
      for (const [field, value] of Object.entries(transformConfig.enrichFields)) {
        transformed[field] = typeof value === 'function' ? value(req) : value;
      }
    }

    return transformed;
  }

  /**
   * Transform response
   */
  transformResponse(response, transformConfig) {
    const transformed = { ...response };

    if (transformConfig.stripFields) {
      for (const field of transformConfig.stripFields) {
        delete transformed[field];
      }
    }

    if (transformConfig.format) {
      return {
        [transformConfig.format]: transformed
      };
    }

    return transformed;
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    for (const key of this.requestMetrics.keys()) {
      this.requestMetrics.set(key, {
        requests: 0,
        success: 0,
        errors: 0,
        avgLatency: 0,
        lastError: null,
        cacheHits: 0,
        cacheMisses: 0
      });
    }
  }

  /**
   * Reset circuit breakers
   */
  resetCircuitBreakers() {
    for (const key of this.circuitBreakers.keys()) {
      this.circuitBreakers.set(key, {
        state: 'closed',
        failures: 0,
        successes: 0,
        lastFailureTime: null,
        openedAt: null
      });
    }
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: 'healthy',
      registeredRoutes: this.routes.size,
      cacheSize: this.requestCache.size,
      metrics: Object.keys(this.requestMetrics).length,
      circuitBreakers: this.circuitBreakers.size,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clear all data
   */
  clear() {
    this.routes.clear();
    this.middlewares = [];
    this.requestCache.clear();
    this.requestMetrics.clear();
    this.circuitBreakers.clear();
    this.requestQueue.clear();
  }
}

export default APIGatewayService;
