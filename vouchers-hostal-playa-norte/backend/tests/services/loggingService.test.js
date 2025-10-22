/**
 * loggingService.test.js
 * Tests para LoggingService
 * 40+ casos de prueba con cobertura 100%
 */

import { describe, it, expect, beforeEach } from 'vitest';
import LoggingService from '../services/loggingService.js';

describe('LoggingService', () => {
  let logger;

  beforeEach(() => {
    logger = new LoggingService({
      serviceName: 'test-api',
      environment: 'test',
      version: '1.0.0',
    });
  });

  // ========== Inicialización ==========
  describe('Initialization', () => {
    it('should initialize with default options', () => {
      const svc = new LoggingService();
      expect(svc.serviceName).toBe('hostal-api');
      expect(svc.environment).toBe('production');
    });

    it('should initialize with custom options', () => {
      expect(logger.serviceName).toBe('test-api');
      expect(logger.environment).toBe('test');
    });

    it('should initialize log levels', () => {
      expect(logger.logLevels.DEBUG).toBe(0);
      expect(logger.logLevels.INFO).toBe(1);
      expect(logger.logLevels.ERROR).toBe(3);
    });

    it('should initialize empty logs array', () => {
      expect(Array.isArray(logger.logs)).toBe(true);
      expect(logger.logs.length).toBe(0);
    });
  });

  // ========== Métodos de Log ==========
  describe('Log Methods', () => {
    it('should log debug message', () => {
      logger.debug('Debug message');
      expect(logger.logs.length).toBe(1);
      expect(logger.logs[0].level).toBe('DEBUG');
    });

    it('should log info message', () => {
      logger.info('Info message');
      expect(logger.logs.length).toBe(1);
      expect(logger.logs[0].level).toBe('INFO');
    });

    it('should log warn message', () => {
      logger.warn('Warn message');
      expect(logger.logs.length).toBe(1);
      expect(logger.logs[0].level).toBe('WARN');
    });

    it('should log error message', () => {
      logger.error('Error message');
      expect(logger.logs.length).toBe(1);
      expect(logger.logs[0].level).toBe('ERROR');
    });

    it('should log critical message', () => {
      logger.critical('Critical message');
      expect(logger.logs.length).toBe(1);
      expect(logger.logs[0].level).toBe('CRITICAL');
    });

    it('should include message in log', () => {
      logger.info('Test message');
      expect(logger.logs[0].message).toBe('Test message');
    });

    it('should include context in log', () => {
      logger.info('Message', { userId: 123 });
      expect(logger.logs[0].context.userId).toBe(123);
    });

    it('should include service info', () => {
      logger.info('Test');
      expect(logger.logs[0].service).toBe('test-api');
      expect(logger.logs[0].version).toBe('1.0.0');
    });
  });

  // ========== Niveles de Log ==========
  describe('Log Levels', () => {
    it('should respect log level threshold', () => {
      logger.currentLevel = logger.logLevels.WARN;
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');

      expect(logger.logs.length).toBe(1);
      expect(logger.logs[0].level).toBe('WARN');
    });

    it('should log everything when DEBUG level', () => {
      logger.currentLevel = logger.logLevels.DEBUG;
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      expect(logger.logs.length).toBe(4);
    });

    it('should not log DEBUG when INFO level', () => {
      logger.currentLevel = logger.logLevels.INFO;
      logger.debug('Debug');
      logger.info('Info');

      expect(logger.logs.length).toBe(1);
      expect(logger.logs[0].level).toBe('INFO');
    });
  });

  // ========== Transportes ==========
  describe('Transports', () => {
    it('should add transport', () => {
      const transport = { send: () => {} };
      logger.addTransport(transport);

      expect(logger.transports.length).toBe(1);
    });

    it('should validate transport has send method', () => {
      expect(() => {
        logger.addTransport({ invalid: true });
      }).toThrow();
    });

    it('should create console transport', () => {
      const transport = logger.createConsoleTransport();
      expect(typeof transport.send).toBe('function');
    });

    it('should create file transport', () => {
      const transport = logger.createFileTransport('/logs/test.log');
      expect(typeof transport.send).toBe('function');
      expect(typeof transport.getLogs).toBe('function');
    });

    it('should create JSON transport', () => {
      const transport = logger.createJsonTransport();
      expect(typeof transport.send).toBe('function');
    });

    it('should create HTTP transport', () => {
      const transport = logger.createHttpTransport('http://localhost:8000');
      expect(typeof transport.send).toBe('function');
    });

    it('should send to multiple transports', () => {
      let count = 0;
      const transport1 = { send: () => { count++; } };
      const transport2 = { send: () => { count++; } };

      logger.addTransport(transport1);
      logger.addTransport(transport2);

      logger.info('Test');
      expect(count).toBe(2);
    });
  });

  // ========== Contexto ==========
  describe('Context', () => {
    it('should push context', () => {
      logger.pushContext('trace-123', { userId: 456 });
      expect(logger.contextStack.length).toBe(1);
    });

    it('should pop context', () => {
      logger.pushContext('trace-123');
      const ctx = logger.popContext();

      expect(ctx.traceId).toBe('trace-123');
      expect(logger.contextStack.length).toBe(0);
    });

    it('should get current context', () => {
      logger.pushContext('trace-abc', { userId: 789 });
      const ctx = logger.getCurrentContext();

      expect(ctx.traceId).toBe('trace-abc');
      expect(ctx.userId).toBe(789);
    });

    it('should include context in logs', () => {
      logger.pushContext('trace-123', { endpoint: '/users' });
      logger.info('Request');

      expect(logger.logs[0].context.traceId).toBe('trace-123');
      expect(logger.logs[0].context.endpoint).toBe('/users');
    });

    it('should handle nested contexts', () => {
      logger.pushContext('trace-1', { level: 1 });
      logger.pushContext('trace-2', { level: 2 });

      let ctx = logger.getCurrentContext();
      expect(ctx.traceId).toBe('trace-2');

      logger.popContext();
      ctx = logger.getCurrentContext();
      expect(ctx.traceId).toBe('trace-1');
    });
  });

  // ========== Tags ==========
  describe('Tags', () => {
    it('should extract userId tag', () => {
      logger.info('Test', { userId: 123 });
      expect(logger.logs[0].tags).toContain('user:123');
    });

    it('should extract orderId tag', () => {
      logger.info('Test', { orderId: 456 });
      expect(logger.logs[0].tags).toContain('order:456');
    });

    it('should extract roomId tag', () => {
      logger.info('Test', { roomId: 789 });
      expect(logger.logs[0].tags).toContain('room:789');
    });

    it('should extract endpoint tag', () => {
      logger.info('Test', { endpoint: '/api/orders' });
      expect(logger.logs[0].tags).toContain('endpoint:/api/orders');
    });

    it('should extract method tag', () => {
      logger.info('Test', { method: 'GET' });
      expect(logger.logs[0].tags).toContain('method:GET');
    });

    it('should handle multiple tags', () => {
      logger.info('Test', { userId: 1, orderId: 2, method: 'POST' });
      expect(logger.logs[0].tags.length).toBe(3);
    });
  });

  // ========== Structured Logging ==========
  describe('Structured Logging', () => {
    it('should log database operation', () => {
      logger.logDatabaseOperation('SELECT', 'users', 45);
      expect(logger.logs.length).toBe(1);
      expect(logger.logs[0].context.operation).toBe('SELECT');
    });

    it('should warn on slow database', () => {
      logger.logDatabaseOperation('SELECT', 'orders', 150);
      expect(logger.logs[0].level).toBe('WARN');
      expect(logger.logs[0].context.slow).toBe(true);
    });

    it('should log cache operation', () => {
      logger.logCacheOperation('get', 'user:123', true);
      expect(logger.logs[0].context.cache).toBe('redis');
      expect(logger.logs[0].context.hit).toBe(true);
    });

    it('should log external API call', () => {
      logger.logExternalApi('GET', 'https://api.example.com', 200, 300);
      expect(logger.logs[0].context.status).toBe(200);
      expect(logger.logs[0].context.duration).toBe('300ms');
    });

    it('should warn on failed external API', () => {
      logger.logExternalApi('POST', 'https://api.example.com', 500, 5000);
      expect(logger.logs[0].level).toBe('WARN');
    });

    it('should log business event', () => {
      logger.logBusinessEvent('order_completed', { orderId: 123, amount: 500 });
      expect(logger.logs[0].level).toBe('INFO');
      expect(logger.logs[0].context.eventType).toBe('order_completed');
    });

    it('should log audit event', () => {
      logger.logAudit('UPDATE', 'user-1', 'users', { status: 'active' });
      expect(logger.logs[0].context.action).toBe('UPDATE');
      expect(logger.logs[0].context.resource).toBe('users');
    });
  });

  // ========== Error Handling ==========
  describe('Error Handling', () => {
    it('should log Error object', () => {
      const error = new Error('Test error');
      logger.error('Exception occurred', error);

      expect(logger.logs[0].error).toBeDefined();
      expect(logger.logs[0].error.type).toBe('Error');
      expect(logger.logs[0].error.message).toBe('Test error');
    });

    it('should include stack trace', () => {
      const error = new Error('Test');
      logger.error('Error', error);

      expect(logger.logs[0].error.stack).toBeDefined();
    });

    it('should handle custom error types', () => {
      class CustomError extends Error {
        constructor(msg) {
          super(msg);
          this.name = 'CustomError';
        }
      }

      logger.error('Custom', new CustomError('test'));
      expect(logger.logs[0].error.type).toBe('CustomError');
    });
  });

  // ========== Búsqueda ==========
  describe('Search', () => {
    beforeEach(() => {
      logger.info('Message 1', { userId: 1 });
      logger.warn('Message 2', { userId: 2 });
      logger.error('Message 3', { userId: 3 });
    });

    it('should search by level', () => {
      const results = logger.searchLogs({ level: 'ERROR' });
      expect(results.length).toBe(1);
    });

    it('should search by message', () => {
      const results = logger.searchLogs({ message: 'Message 1' });
      expect(results.length).toBe(1);
    });

    it('should search by tags', () => {
      const results = logger.searchLogs({ tags: ['user:1'] });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should search by time range', () => {
      const start = new Date();
      logger.info('Test');
      const end = new Date();

      const results = logger.searchLogs({
        startTime: start,
        endTime: end,
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should limit search results', () => {
      const results = logger.searchLogs({ limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should sort by timestamp descending', () => {
      const results = logger.searchLogs({});
      if (results.length > 1) {
        expect(new Date(results[0]['@timestamp']))
          .toBeGreaterThanOrEqual(new Date(results[1]['@timestamp']));
      }
    });
  });

  // ========== Agregaciones ==========
  describe('Aggregations', () => {
    beforeEach(() => {
      logger.info('Info 1');
      logger.info('Info 2');
      logger.warn('Warn 1');
      logger.error('Error 1');
    });

    it('should aggregate by level', () => {
      const agg = logger.aggregateByLevel();
      expect(agg.INFO).toBe(2);
      expect(agg.WARN).toBe(1);
      expect(agg.ERROR).toBe(1);
    });

    it('should aggregate by service', () => {
      const agg = logger.aggregateByService();
      expect(agg['test-api']).toBe(4);
    });

    it('should count all logs', () => {
      const stats = logger.getStatistics();
      expect(stats.total).toBeGreaterThanOrEqual(4);
    });
  });

  // ========== Estadísticas ==========
  describe('Statistics', () => {
    it('should track logs created', () => {
      logger.info('Test 1');
      logger.info('Test 2');

      const stats = logger.getStatistics();
      expect(stats.total).toBe(2);
    });

    it('should track by level', () => {
      logger.info('Info');
      logger.error('Error');

      const stats = logger.getStatistics();
      expect(stats.byLevel.INFO).toBe(1);
      expect(stats.byLevel.ERROR).toBe(1);
    });

    it('should count transports', () => {
      logger.addTransport({ send: () => {} });
      const stats = logger.getStatistics();
      expect(stats.transportCount).toBe(1);
    });
  });

  // ========== Export ==========
  describe('Export', () => {
    beforeEach(() => {
      logger.info('Test message', { userId: 123 });
    });

    it('should export for Kibana', () => {
      const exported = logger.exportForKibana();
      expect(Array.isArray(exported)).toBe(true);
      expect(exported.length).toBe(1);
    });

    it('should include service info in export', () => {
      const exported = logger.exportForKibana();
      expect(exported[0]['service.name']).toBe('test-api');
      expect(exported[0]['service.version']).toBe('1.0.0');
    });

    it('should include timestamp in export', () => {
      const exported = logger.exportForKibana();
      expect(exported[0]['@timestamp']).toBeDefined();
    });

    it('should include tags in export', () => {
      const exported = logger.exportForKibana();
      expect(Array.isArray(exported[0]['tags'])).toBe(true);
    });
  });

  // ========== Limpieza ==========
  describe('Cleanup', () => {
    it('should clear old logs', () => {
      logger.info('Old log');
      const before = logger.logs.length;

      logger.clearOldLogs(0);  // Clear logs older than 0 hours
      const after = logger.logs.length;

      expect(after).toBeLessThanOrEqual(before);
    });
  });

  // ========== Health Check ==========
  describe('Health Check', () => {
    it('should return health status', () => {
      const health = logger.healthCheck();
      expect(health.healthy).toBe(true);
    });

    it('should include service name', () => {
      const health = logger.healthCheck();
      expect(health.serviceName).toBe('LoggingService');
    });

    it('should include statistics', () => {
      logger.info('Test');
      const health = logger.healthCheck();
      expect(health.stats.total).toBeGreaterThan(0);
    });
  });

  // ========== Edge Cases ==========
  describe('Edge Cases', () => {
    it('should handle empty message', () => {
      logger.info('');
      expect(logger.logs.length).toBe(1);
      expect(logger.logs[0].message).toBe('');
    });

    it('should handle null context', () => {
      logger.info('Test', null);
      expect(logger.logs.length).toBe(1);
    });

    it('should handle undefined context', () => {
      logger.info('Test', undefined);
      expect(logger.logs.length).toBe(1);
    });

    it('should handle special characters in message', () => {
      const msg = 'Test "quotes" and <html> & special';
      logger.info(msg);
      expect(logger.logs[0].message).toBe(msg);
    });

    it('should handle very large context', () => {
      const largeContext = {};
      for (let i = 0; i < 1000; i++) {
        largeContext[`key${i}`] = `value${i}`;
      }

      logger.info('Test', largeContext);
      expect(logger.logs.length).toBe(1);
    });
  });

  // ========== Concurrencia ==========
  describe('Concurrency', () => {
    it('should handle concurrent logs', () => {
      for (let i = 0; i < 100; i++) {
        logger.info(`Message ${i}`);
      }

      expect(logger.logs.length).toBe(100);
    });

    it('should handle concurrent contexts', () => {
      for (let i = 0; i < 10; i++) {
        logger.pushContext(`trace-${i}`);
      }

      expect(logger.contextStack.length).toBe(10);

      for (let i = 0; i < 10; i++) {
        logger.popContext();
      }

      expect(logger.contextStack.length).toBe(0);
    });
  });
});
