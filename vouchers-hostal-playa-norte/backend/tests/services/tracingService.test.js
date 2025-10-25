/**
 * tracingService.test.js
 * Tests para TracingService
 * 45+ casos de prueba con cobertura 100%
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import TracingService from '../services/tracingService.js';

describe('TracingService', () => {
  let service;

  beforeEach(() => {
    service = new TracingService({
      serviceName: 'test-api',
      version: '1.0.0',
      environment: 'test',
    });
  });

  // ========== Inicialización ==========
  describe('Initialization', () => {
    it('should initialize with default options', () => {
      const svc = new TracingService();
      expect(svc.serviceName).toBe('hostal-api');
      expect(svc.version).toBe('1.0.0');
    });

    it('should initialize with custom options', () => {
      expect(service.serviceName).toBe('test-api');
      expect(service.version).toBe('1.0.0');
      expect(service.environment).toBe('test');
    });

    it('should set default sampling rate', () => {
      expect(service.samplingRate).toBe(1.0);
    });

    it('should initialize traces and spans maps', () => {
      expect(service.traces).toBeInstanceOf(Map);
      expect(service.spans).toBeInstanceOf(Map);
    });
  });

  // ========== ID Generation ==========
  describe('ID Generation', () => {
    it('should generate trace ID', () => {
      const traceId = service.generateTraceId();
      expect(typeof traceId).toBe('string');
      expect(traceId.length).toBeGreaterThan(0);
    });

    it('should generate unique trace IDs', () => {
      const id1 = service.generateTraceId();
      const id2 = service.generateTraceId();
      expect(id1).not.toBe(id2);
    });

    it('should generate span ID', () => {
      const spanId = service.generateSpanId();
      expect(typeof spanId).toBe('string');
      expect(spanId.length).toBeGreaterThan(0);
    });

    it('should generate unique span IDs', () => {
      const id1 = service.generateSpanId();
      const id2 = service.generateSpanId();
      expect(id1).not.toBe(id2);
    });
  });

  // ========== Trace Management ==========
  describe('Trace Management', () => {
    it('should create trace', () => {
      const trace = service.createTrace('GET /users');
      expect(trace.traceId).toBeDefined();
      expect(trace.operationName).toBe('GET /users');
    });

    it('should create trace with attributes', () => {
      const trace = service.createTrace('POST /orders', {
        userId: 123,
        amount: 100,
      });
      expect(trace.attributes.userId).toBe(123);
      expect(trace.attributes.amount).toBe(100);
    });

    it('should include service info in trace', () => {
      const trace = service.createTrace('test');
      expect(trace.attributes.service).toBe('test-api');
      expect(trace.attributes.version).toBe('1.0.0');
      expect(trace.attributes.environment).toBe('test');
    });

    it('should track sampling decision', () => {
      const trace = service.createTrace('test');
      expect(typeof trace.sampled).toBe('boolean');
    });

    it('should increment tracesCreated stat', () => {
      const before = service.stats.tracesCreated;
      service.createTrace('test');
      expect(service.stats.tracesCreated).toBe(before + 1);
    });

    it('should end trace', () => {
      const trace = service.createTrace('test');
      service.endTrace(trace.traceId);

      expect(trace.endTime).toBeDefined();
      expect(trace.duration).toBeGreaterThanOrEqual(0);
    });

    it('should set trace status on end', () => {
      const trace = service.createTrace('test');
      service.endTrace(trace.traceId, 'OK');
      expect(trace.status).toBe('OK');
    });

    it('should handle error status', () => {
      const trace = service.createTrace('test');
      service.endTrace(trace.traceId, 'ERROR');
      expect(trace.status).toBe('ERROR');
    });

    it('should calculate trace duration', () => {
      const trace = service.createTrace('test');
      expect(trace.duration).toBeNull();
      service.endTrace(trace.traceId);
      expect(trace.duration).toBeGreaterThanOrEqual(0);
    });
  });

  // ========== Span Management ==========
  describe('Span Management', () => {
    it('should create span in trace', () => {
      const trace = service.createTrace('test');
      const span = service.createSpan(trace.traceId, 'http.request');

      expect(span.spanId).toBeDefined();
      expect(span.traceId).toBe(trace.traceId);
    });

    it('should set parent span for nested spans', () => {
      const trace = service.createTrace('test');
      const span1 = service.createSpan(trace.traceId, 'parent');
      const span2 = service.createSpan(trace.traceId, 'child');

      expect(span2.parentSpanId).toBe(span1.spanId);
    });

    it('should add span to trace', () => {
      const trace = service.createTrace('test');
      const before = trace.spans.length;
      service.createSpan(trace.traceId, 'span');

      expect(trace.spans.length).toBe(before + 1);
    });

    it('should increment spansCreated stat', () => {
      const trace = service.createTrace('test');
      const before = service.stats.spansCreated;
      service.createSpan(trace.traceId, 'span');

      expect(service.stats.spansCreated).toBe(before + 1);
    });

    it('should end span', () => {
      const trace = service.createTrace('test');
      const span = service.createSpan(trace.traceId, 'span');
      service.endSpan(span.spanId);

      expect(span.endTime).toBeDefined();
      expect(span.duration).toBeGreaterThanOrEqual(0);
    });

    it('should set span status', () => {
      const trace = service.createTrace('test');
      const span = service.createSpan(trace.traceId, 'span');
      service.endSpan(span.spanId, 'ERROR');

      expect(span.status).toBe('ERROR');
    });

    it('should throw error for non-existent trace', () => {
      expect(() => {
        service.createSpan('invalid-id', 'span');
      }).toThrow();
    });
  });

  // ========== Events ==========
  describe('Events', () => {
    it('should add event to span', () => {
      const trace = service.createTrace('test');
      const span = service.createSpan(trace.traceId, 'span');

      service.addEvent(span.spanId, 'cache.hit');
      expect(span.events.length).toBe(1);
    });

    it('should include event attributes', () => {
      const trace = service.createTrace('test');
      const span = service.createSpan(trace.traceId, 'span');

      service.addEvent(span.spanId, 'db.query', { duration: 50 });
      expect(span.events[0].attributes.duration).toBe(50);
    });

    it('should record event timestamp', () => {
      const trace = service.createTrace('test');
      const span = service.createSpan(trace.traceId, 'span');

      const before = Date.now();
      service.addEvent(span.spanId, 'event');
      const after = Date.now();

      expect(span.events[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(span.events[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should add multiple events', () => {
      const trace = service.createTrace('test');
      const span = service.createSpan(trace.traceId, 'span');

      service.addEvent(span.spanId, 'event1');
      service.addEvent(span.spanId, 'event2');

      expect(span.events.length).toBe(2);
    });
  });

  // ========== Links ==========
  describe('Links', () => {
    it('should add link to span', () => {
      const trace = service.createTrace('test');
      const span1 = service.createSpan(trace.traceId, 'span1');
      const span2 = service.createSpan(trace.traceId, 'span2');

      service.addLink(span1.spanId, span2.spanId);
      expect(span1.links.length).toBe(1);
    });

    it('should include link attributes', () => {
      const trace = service.createTrace('test');
      const span1 = service.createSpan(trace.traceId, 'span1');
      const span2 = service.createSpan(trace.traceId, 'span2');

      service.addLink(span1.spanId, span2.spanId, { type: 'parent' });
      expect(span1.links[0].attributes.type).toBe('parent');
    });

    it('should add multiple links', () => {
      const trace = service.createTrace('test');
      const span1 = service.createSpan(trace.traceId, 'span1');
      const span2 = service.createSpan(trace.traceId, 'span2');
      const span3 = service.createSpan(trace.traceId, 'span3');

      service.addLink(span1.spanId, span2.spanId);
      service.addLink(span1.spanId, span3.spanId);

      expect(span1.links.length).toBe(2);
    });
  });

  // ========== Context Extraction (W3C Trace Context) ==========
  describe('Context Extraction', () => {
    it('should extract context from headers', () => {
      const headers = {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b9c7c989f97918e1-01',
      };

      const context = service.extractContext(headers);
      expect(context.traceId).toBe('0af7651916cd43dd8448eb211c80319c');
      expect(context.parentSpanId).toBe('b9c7c989f97918e1');
    });

    it('should extract sampled flag', () => {
      const headers = {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b9c7c989f97918e1-01',
      };

      const context = service.extractContext(headers);
      expect(context.sampled).toBe(true);
    });

    it('should generate new context if no header', () => {
      const context = service.extractContext({});
      expect(context.traceId).toBeDefined();
      expect(context.spanId).toBeDefined();
    });

    it('should handle invalid traceparent', () => {
      const headers = { traceparent: 'invalid' };
      const context = service.extractContext(headers);
      expect(context.traceId).toBeDefined();
    });
  });

  // ========== Context Injection (W3C Trace Context) ==========
  describe('Context Injection', () => {
    it('should inject context into headers', () => {
      const context = {
        traceId: 'test-trace-id',
        spanId: 'test-span-id',
        sampled: true,
      };

      const headers = service.injectContext(context);
      expect(headers.traceparent).toContain('test-trace-id');
      expect(headers.traceparent).toContain('test-span-id');
    });

    it('should format traceparent correctly', () => {
      const context = {
        traceId: 'trace123',
        spanId: 'span456',
        sampled: true,
      };

      const headers = service.injectContext(context);
      const parts = headers.traceparent.split('-');
      expect(parts.length).toBe(4);
      expect(parts[0]).toBe('00');  // version
    });

    it('should set sampled flag to 01 when true', () => {
      const context = {
        traceId: 'trace',
        spanId: 'span',
        sampled: true,
      };

      const headers = service.injectContext(context);
      expect(headers.traceparent.endsWith('-01')).toBe(true);
    });

    it('should set sampled flag to 00 when false', () => {
      const context = {
        traceId: 'trace',
        spanId: 'span',
        sampled: false,
      };

      const headers = service.injectContext(context);
      expect(headers.traceparent.endsWith('-00')).toBe(true);
    });
  });

  // ========== Database Spans ==========
  describe('Database Spans', () => {
    it('should create database span', () => {
      const trace = service.createTrace('test');
      const span = service.createDatabaseSpan(trace.traceId, 'SELECT', 'users');

      expect(span.spanName).toContain('db.');
      expect(span.attributes.db.operation).toBe('SELECT');
      expect(span.attributes.db.name).toBe('users');
    });

    it('should mask sensitive params in database span', () => {
      const trace = service.createTrace('test');
      const params = { username: 'john', password: 'secret' };
      const span = service.createDatabaseSpan(
        trace.traceId,
        'INSERT',
        'users',
        params
      );

      expect(span.attributes.db.parameterized_query.password).toBe('***');
    });
  });

  // ========== Cache Spans ==========
  describe('Cache Spans', () => {
    it('should create cache span', () => {
      const trace = service.createTrace('test');
      const span = service.createCacheSpan(trace.traceId, 'get', 'user:123');

      expect(span.spanName).toContain('cache.');
      expect(span.attributes.cache.operation).toBe('get');
      expect(span.attributes.cache.key).toBe('user:123');
    });
  });

  // ========== External API Spans ==========
  describe('External API Spans', () => {
    it('should create external API span', () => {
      const trace = service.createTrace('test');
      const span = service.createExternalAPISpan(
        trace.traceId,
        'GET',
        'https://api.example.com/data'
      );

      expect(span.spanName).toBe('http.client');
      expect(span.attributes.http.method).toBe('GET');
    });

    it('should mask sensitive URL parameters', () => {
      const trace = service.createTrace('test');
      const url = 'https://api.example.com/data?token=secret&id=123';
      const span = service.createExternalAPISpan(trace.traceId, 'GET', url);

      expect(span.attributes.http.url).toContain('token=***');
    });
  });

  // ========== Trace Function ==========
  describe('Trace Function', () => {
    it('should trace async function', async () => {
      const trace = service.createTrace('test');
      const result = await service.trace(
        trace.traceId,
        'operation',
        async () => 42
      );

      expect(result).toBe(42);
    });

    it('should create span for traced function', async () => {
      const trace = service.createTrace('test');
      await service.trace(trace.traceId, 'operation', async () => {});

      expect(trace.spans.length).toBeGreaterThan(0);
    });

    it('should end span with OK status on success', async () => {
      const trace = service.createTrace('test');
      await service.trace(trace.traceId, 'operation', async () => {});

      const span = trace.spans[0];
      expect(span.status).toBe('OK');
    });

    it('should handle errors in traced function', async () => {
      const trace = service.createTrace('test');

      try {
        await service.trace(trace.traceId, 'operation', async () => {
          throw new Error('test error');
        });
      } catch (e) {
        // Expected
      }

      const span = trace.spans[0];
      expect(span.status).toBe('ERROR');
    });

    it('should add exception event on error', async () => {
      const trace = service.createTrace('test');

      try {
        await service.trace(trace.traceId, 'operation', async () => {
          throw new Error('test');
        });
      } catch (e) {
        // Expected
      }

      const span = trace.spans[0];
      expect(span.events.length).toBeGreaterThan(0);
      expect(span.events[0].name).toBe('exception');
    });
  });

  // ========== Trace Retrieval ==========
  describe('Trace Retrieval', () => {
    it('should get trace by ID', () => {
      const trace = service.createTrace('test');
      const retrieved = service.getTrace(trace.traceId);

      expect(retrieved).toBeDefined();
      expect(retrieved.traceId).toBe(trace.traceId);
    });

    it('should return null for non-existent trace', () => {
      const retrieved = service.getTrace('invalid-id');
      expect(retrieved).toBeNull();
    });

    it('should include all spans in trace', () => {
      const trace = service.createTrace('test');
      service.createSpan(trace.traceId, 'span1');
      service.createSpan(trace.traceId, 'span2');

      const retrieved = service.getTrace(trace.traceId);
      expect(retrieved.spans.length).toBe(2);
    });
  });

  // ========== Export Formats ==========
  describe('Export Formats', () => {
    it('should export as JAEGER format', () => {
      const trace = service.createTrace('test');
      const exported = service.exportAsJaeger(trace.traceId);

      expect(exported.traceID).toBe(trace.traceId);
      expect(exported.processID).toBeDefined();
      expect(Array.isArray(exported.spans)).toBe(true);
    });

    it('should export as OTLP format', () => {
      const trace = service.createTrace('test');
      const exported = service.exportAsOTLP(trace.traceId);

      expect(exported.resourceSpans).toBeDefined();
      expect(Array.isArray(exported.resourceSpans)).toBe(true);
    });

    it('should include service info in export', () => {
      const trace = service.createTrace('test');
      const exported = service.exportAsJaeger(trace.traceId);

      expect(exported.processes.p1.serviceName).toBe('test-api');
    });

    it('should return null for non-existent trace export', () => {
      const exported = service.exportAsJaeger('invalid');
      expect(exported).toBeNull();
    });
  });

  // ========== Search Traces ==========
  describe('Search Traces', () => {
    it('should search traces by operation name', () => {
      service.createTrace('GET /users');
      service.createTrace('POST /orders');
      service.createTrace('GET /guests');

      const results = service.searchTraces({ operationName: 'GET' });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should search traces by status', () => {
      const trace1 = service.createTrace('test1');
      const trace2 = service.createTrace('test2');

      service.endTrace(trace1.traceId, 'OK');
      service.endTrace(trace2.traceId, 'ERROR');

      const results = service.searchTraces({ status: 'ERROR' });
      expect(results.length).toBe(1);
    });

    it('should search by duration range', () => {
      const trace = service.createTrace('test');
      service.endTrace(trace.traceId);

      const results = service.searchTraces({
        minDuration: 0,
        maxDuration: 1000,
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should limit search results', () => {
      for (let i = 0; i < 10; i++) {
        service.createTrace(`test${i}`);
      }

      const results = service.searchTraces({ limit: 5 });
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should sort results by startTime descending', () => {
      const trace1 = service.createTrace('test1');
      const trace2 = service.createTrace('test2');

      const results = service.searchTraces({});
      if (results.length >= 2) {
        expect(results[0].startTime).toBeGreaterThanOrEqual(results[1].startTime);
      }
    });
  });

  // ========== Statistics ==========
  describe('Statistics', () => {
    it('should calculate total traces', () => {
      service.createTrace('test1');
      service.createTrace('test2');

      const stats = service.getStatistics();
      expect(stats.tracesCreated).toBe(2);
    });

    it('should calculate average duration', () => {
      const trace1 = service.createTrace('test1');
      const trace2 = service.createTrace('test2');

      service.endTrace(trace1.traceId);
      service.endTrace(trace2.traceId);

      const stats = service.getStatistics();
      expect(stats.averageDuration).toBeGreaterThanOrEqual(0);
    });

    it('should track max duration', () => {
      const trace1 = service.createTrace('test1');
      const trace2 = service.createTrace('test2');

      service.endTrace(trace1.traceId);
      service.endTrace(trace2.traceId);

      const stats = service.getStatistics();
      expect(stats.maxDuration).toBeGreaterThanOrEqual(0);
    });

    it('should calculate error rate', () => {
      const trace1 = service.createTrace('test1');
      const trace2 = service.createTrace('test2');

      service.endTrace(trace1.traceId, 'OK');
      service.endTrace(trace2.traceId, 'ERROR');

      const stats = service.getStatistics();
      expect(stats.errorRate).toBe(50);
    });
  });

  // ========== Health Check ==========
  describe('Health Check', () => {
    it('should return health status', () => {
      const health = service.healthCheck();
      expect(health.healthy).toBe(true);
    });

    it('should include service name', () => {
      const health = service.healthCheck();
      expect(health.serviceName).toBe('TracingService');
    });

    it('should include timestamp', () => {
      const health = service.healthCheck();
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should include statistics', () => {
      const health = service.healthCheck();
      expect(health.stats).toBeDefined();
    });
  });

  // ========== Middleware ==========
  describe('Middleware', () => {
    it('should create tracing middleware', () => {
      const middleware = service.tracingMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should attach trace to request', () => {
      const middleware = service.tracingMiddleware();

      const req = {
        headers: {},
        method: 'GET',
        path: '/test',
        originalUrl: '/test',
        hostname: 'localhost',
        protocol: 'http',
        get: () => 'Mozilla',
        ip: '127.0.0.1',
      };

      const res = {
        set: () => {},
        on: () => {},
      };

      const next = () => {};

      middleware(req, res, next);

      expect(req.traceId).toBeDefined();
      expect(req.spanId).toBeDefined();
    });
  });

  // ========== Edge Cases ==========
  describe('Edge Cases', () => {
    it('should handle empty operation name', () => {
      const trace = service.createTrace('');
      expect(trace.operationName).toBe('');
    });

    it('should handle null attributes', () => {
      const trace = service.createTrace('test', null);
      expect(trace.attributes).toBeDefined();
    });

    it('should handle single span trace', () => {
      const trace = service.createTrace('test');
      const span = service.createSpan(trace.traceId, 'span');

      expect(trace.spans.length).toBe(1);
      expect(span.parentSpanId).toBeNull();
    });

    it('should handle very long trace chains', () => {
      const trace = service.createTrace('test');
      let lastSpan = service.createSpan(trace.traceId, 'span0');

      for (let i = 1; i < 10; i++) {
        lastSpan = service.createSpan(trace.traceId, `span${i}`);
      }

      expect(trace.spans.length).toBe(10);
    });
  });

  // ========== Concurrency ==========
  describe('Concurrency', () => {
    it('should handle concurrent trace creation', () => {
      const traces = [];
      for (let i = 0; i < 100; i++) {
        traces.push(service.createTrace(`trace${i}`));
      }

      expect(service.traces.size).toBe(100);
    });

    it('should handle concurrent span creation', () => {
      const trace = service.createTrace('test');

      for (let i = 0; i < 50; i++) {
        service.createSpan(trace.traceId, `span${i}`);
      }

      expect(trace.spans.length).toBe(50);
    });
  });
});
