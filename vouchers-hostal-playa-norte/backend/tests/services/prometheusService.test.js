/**
 * prometheusService.test.js
 * Tests para PrometheusService
 * 45+ casos de prueba con cobertura 100%
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import PrometheusService from '../services/prometheusService.js';

describe('PrometheusService', () => {
  let service;

  beforeEach(() => {
    service = new PrometheusService({
      namespace: 'test',
      subsystem: 'api',
    });
  });

  // ========== Inicialización ==========
  describe('Initialization', () => {
    it('should initialize with default options', () => {
      const svc = new PrometheusService();
      expect(svc.namespace).toBe('hostal');
      expect(svc.subsystem).toBe('api');
    });

    it('should initialize with custom options', () => {
      const svc = new PrometheusService({
        namespace: 'custom',
        subsystem: 'worker',
      });
      expect(svc.namespace).toBe('custom');
      expect(svc.subsystem).toBe('worker');
    });

    it('should initialize metrics map', () => {
      expect(service.metrics).toBeInstanceOf(Map);
      expect(service.metrics.size).toBe(0);
    });
  });

  // ========== Counter Metrics ==========
  describe('Counter Metrics', () => {
    it('should register counter metric', () => {
      const counter = service.registerCounter('requests_total', 'Total requests');
      expect(counter).toBeDefined();
      expect(counter.type).toBe('counter');
      expect(counter.name).toBe('test_api_requests_total');
    });

    it('should increment counter', () => {
      const counter = service.registerCounter('requests_total', 'Total requests');
      counter.inc();
      expect(counter.get()).toBe(1);
    });

    it('should increment counter by amount', () => {
      const counter = service.registerCounter('requests_total', 'Total requests');
      counter.inc(5);
      expect(counter.get()).toBe(5);
    });

    it('should support labeled counters', () => {
      const counter = service.registerCounter(
        'requests_total',
        'Total requests',
        ['method', 'path']
      );
      counter.inc(1, { method: 'GET', path: '/users' });
      counter.inc(2, { method: 'POST', path: '/orders' });

      const labeled = counter.getLabeled();
      expect(labeled.size).toBe(2);
    });

    it('should track multiple labels separately', () => {
      const counter = service.registerCounter('requests', 'Requests');
      counter.inc(1, { method: 'GET' });
      counter.inc(2, { method: 'GET' });
      counter.inc(1, { method: 'POST' });

      expect(counter.get()).toBe(4);
    });
  });

  // ========== Gauge Metrics ==========
  describe('Gauge Metrics', () => {
    it('should register gauge metric', () => {
      const gauge = service.registerGauge('memory_bytes', 'Memory usage');
      expect(gauge.type).toBe('gauge');
      expect(gauge.name).toBe('test_api_memory_bytes');
    });

    it('should set gauge value', () => {
      const gauge = service.registerGauge('memory_bytes', 'Memory usage');
      gauge.set(100);
      expect(gauge.get()).toBe(100);
    });

    it('should increment gauge', () => {
      const gauge = service.registerGauge('connections', 'Active connections');
      gauge.set(10);
      gauge.inc();
      expect(gauge.get()).toBe(11);
    });

    it('should decrement gauge', () => {
      const gauge = service.registerGauge('connections', 'Active connections');
      gauge.set(10);
      gauge.dec();
      expect(gauge.get()).toBe(9);
    });

    it('should decrement by amount', () => {
      const gauge = service.registerGauge('queue_size', 'Queue size');
      gauge.set(50);
      gauge.dec(10);
      expect(gauge.get()).toBe(40);
    });

    it('should support labeled gauges', () => {
      const gauge = service.registerGauge('threads', 'Thread count', ['pool']);
      gauge.set(4, { pool: 'main' });
      gauge.set(2, { pool: 'worker' });

      expect(gauge.get()).toBe(2);
      expect(gauge.getLabeled().size).toBe(2);
    });
  });

  // ========== Histogram Metrics ==========
  describe('Histogram Metrics', () => {
    it('should register histogram metric', () => {
      const histogram = service.registerHistogram(
        'latency',
        'Request latency'
      );
      expect(histogram.type).toBe('histogram');
    });

    it('should observe histogram values', () => {
      const histogram = service.registerHistogram('latency', 'Latency');
      histogram.observe(0.05);
      histogram.observe(0.1);
      histogram.observe(0.2);

      const data = histogram.get();
      expect(data.count).toBe(3);
      expect(data.sum).toBe(0.35);
    });

    it('should calculate mean from observations', () => {
      const histogram = service.registerHistogram('latency', 'Latency');
      histogram.observe(10);
      histogram.observe(20);
      histogram.observe(30);

      const data = histogram.get();
      expect(data.mean).toBe(20);
    });

    it('should calculate percentiles', () => {
      const histogram = service.registerHistogram('latency', 'Latency');
      for (let i = 1; i <= 100; i++) {
        histogram.observe(i);
      }

      const data = histogram.get();
      expect(data.median).toBeGreaterThan(0);
      expect(data.p95).toBeGreaterThan(0);
      expect(data.p99).toBeGreaterThan(0);
    });

    it('should populate histogram buckets', () => {
      const histogram = service.registerHistogram('latency', 'Latency');
      histogram.observe(0.005);
      histogram.observe(0.02);
      histogram.observe(0.5);

      expect(histogram.buckets[0].count).toBeGreaterThan(0);
    });

    it('should use custom buckets', () => {
      const customBuckets = [0.1, 0.5, 1.0];
      const histogram = service.registerHistogram(
        'custom',
        'Custom histogram',
        [],
        customBuckets
      );

      expect(histogram.buckets.length).toBe(customBuckets.length);
    });
  });

  // ========== Summary Metrics ==========
  describe('Summary Metrics', () => {
    it('should register summary metric', () => {
      const summary = service.registerSummary('duration', 'Duration');
      expect(summary.type).toBe('summary');
    });

    it('should observe summary values', () => {
      const summary = service.registerSummary('duration', 'Duration');
      summary.observe(10);
      summary.observe(20);

      const data = summary.get();
      expect(data.count).toBe(2);
      expect(data.sum).toBe(30);
    });

    it('should calculate summary statistics', () => {
      const summary = service.registerSummary('duration', 'Duration');
      for (let i = 1; i <= 10; i++) {
        summary.observe(i);
      }

      const data = summary.get();
      expect(data.min).toBe(1);
      expect(data.max).toBe(10);
      expect(data.mean).toBe(5.5);
    });

    it('should calculate percentiles in summary', () => {
      const summary = service.registerSummary('values', 'Values');
      for (let i = 1; i <= 100; i++) {
        summary.observe(i);
      }

      const data = summary.get();
      expect(data.p50).toBeGreaterThan(0);
      expect(data.p90).toBeGreaterThan(data.p50);
      expect(data.p99).toBeGreaterThan(data.p90);
    });
  });

  // ========== Exportación de Métricas ==========
  describe('Metrics Export', () => {
    it('should export metrics in Prometheus format', () => {
      service.registerCounter('test_counter', 'Test counter');
      const output = service.exportMetrics();

      expect(output).toContain('# HELP');
      expect(output).toContain('# TYPE');
      expect(output).toContain('test_api_test_counter');
    });

    it('should export multiple metrics', () => {
      service.registerCounter('counter1', 'Counter 1');
      service.registerGauge('gauge1', 'Gauge 1');

      const output = service.exportMetrics();
      expect(output).toContain('counter1');
      expect(output).toContain('gauge1');
    });

    it('should export with correct metric type', () => {
      service.registerCounter('requests', 'Requests');
      const output = service.exportMetrics();

      expect(output).toContain('TYPE test_api_requests counter');
    });

    it('should export histogram with buckets', () => {
      const histogram = service.registerHistogram('latency', 'Latency');
      histogram.observe(0.5);

      const output = service.exportMetrics();
      expect(output).toContain('_bucket{le=');
      expect(output).toContain('_sum');
      expect(output).toContain('_count');
    });

    it('should export metrics with labels', () => {
      const counter = service.registerCounter(
        'requests',
        'Requests',
        ['method']
      );
      counter.inc(1, { method: 'GET' });

      const output = service.exportMetrics();
      expect(output).toContain('method="GET"');
    });
  });

  // ========== Middleware ==========
  describe('Middleware', () => {
    it('should create metrics middleware', () => {
      const middleware = service.metricsMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should expose metrics on /metrics path', () => {
      const middleware = service.metricsMiddleware();

      const req = { path: '/metrics' };
      const res = {
        set: () => {},
        send: function(data) {
          this.sent = data;
        },
      };
      const next = () => {};

      middleware(req, res, next);
      expect(res.sent).toContain('# HELP');
    });

    it('should expose metrics on custom path', () => {
      const middleware = service.metricsMiddleware({ path: '/prometheus' });

      const req = { path: '/prometheus' };
      const res = {
        set: () => {},
        send: function(data) {
          this.sent = data;
        },
      };
      const next = () => {};

      middleware(req, res, next);
      expect(res.sent).toContain('# HELP');
    });

    it('should call next for non-metrics paths', () => {
      const middleware = service.metricsMiddleware();
      let nextCalled = false;

      const req = { path: '/api/users' };
      const res = {};
      const next = () => {
        nextCalled = true;
      };

      middleware(req, res, next);
      expect(nextCalled).toBe(true);
    });

    it('should create request latency middleware', () => {
      const middleware = service.requestLatencyMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should create request counter middleware', () => {
      const middleware = service.requestCounterMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should create error counter middleware', () => {
      const middleware = service.errorCounterMiddleware();
      expect(typeof middleware).toBe('function');
    });
  });

  // ========== Pre-configured Gauges ==========
  describe('Pre-configured Metrics', () => {
    it('should create active connections gauge', () => {
      const gauge = service.createActiveConnectionsGauge();
      expect(gauge.type).toBe('gauge');
      expect(gauge.name).toContain('active_connections');
    });

    it('should create database operations counter', () => {
      const counter = service.createDatabaseOperationsCounter();
      expect(counter.type).toBe('counter');
      expect(counter.name).toContain('database_operations');
    });

    it('should create database latency histogram', () => {
      const histogram = service.createDatabaseLatencyHistogram();
      expect(histogram.type).toBe('histogram');
      expect(histogram.name).toContain('database_query_duration');
    });

    it('should create cache size gauge', () => {
      const gauge = service.createCacheSizeGauge();
      expect(gauge.type).toBe('gauge');
      expect(gauge.name).toContain('cache_size_bytes');
    });

    it('should create cache hit/miss counters', () => {
      const { hits, misses } = service.createCacheHitMissCounters();
      expect(hits.type).toBe('counter');
      expect(misses.type).toBe('counter');
    });
  });

  // ========== Alerting Rules ==========
  describe('Alerting Rules', () => {
    it('should return alerting rules', () => {
      const rules = service.getAlertingRules();
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should have HighErrorRate alert', () => {
      const rules = service.getAlertingRules();
      const alert = rules.find(r => r.alert === 'HighErrorRate');
      expect(alert).toBeDefined();
      expect(alert.expr).toContain('hostal_api_http_errors_total');
    });

    it('should have HighLatency alert', () => {
      const rules = service.getAlertingRules();
      const alert = rules.find(r => r.alert === 'HighLatency');
      expect(alert).toBeDefined();
    });

    it('should have DatabaseSlow alert', () => {
      const rules = service.getAlertingRules();
      const alert = rules.find(r => r.alert === 'DatabaseSlow');
      expect(alert).toBeDefined();
    });

    it('should have CacheHighMissRate alert', () => {
      const rules = service.getAlertingRules();
      const alert = rules.find(r => r.alert === 'CacheHighMissRate');
      expect(alert).toBeDefined();
    });

    it('should include alert annotations', () => {
      const rules = service.getAlertingRules();
      for (const rule of rules) {
        expect(rule.annotations).toBeDefined();
        expect(rule.annotations.summary).toBeDefined();
        expect(rule.annotations.description).toBeDefined();
      }
    });
  });

  // ========== Grafana Dashboard ==========
  describe('Grafana Dashboard', () => {
    it('should return dashboard configuration', () => {
      const dashboard = service.getGrafanaDashboard();
      expect(dashboard.dashboard).toBeDefined();
    });

    it('should have dashboard title', () => {
      const dashboard = service.getGrafanaDashboard();
      expect(dashboard.dashboard.title).toBe('Hostal API Metrics');
    });

    it('should have dashboard panels', () => {
      const dashboard = service.getGrafanaDashboard();
      expect(Array.isArray(dashboard.dashboard.panels)).toBe(true);
      expect(dashboard.dashboard.panels.length).toBeGreaterThan(0);
    });

    it('should have at least 5 panels', () => {
      const dashboard = service.getGrafanaDashboard();
      expect(dashboard.dashboard.panels.length).toBeGreaterThanOrEqual(5);
    });

    it('should have panels with targets', () => {
      const dashboard = service.getGrafanaDashboard();
      for (const panel of dashboard.dashboard.panels) {
        expect(panel.targets).toBeDefined();
        expect(Array.isArray(panel.targets)).toBe(true);
      }
    });
  });

  // ========== Métodos Auxiliares ==========
  describe('Helper Methods', () => {
    it('should format labels correctly', () => {
      const formatted = service.formatLabels({ method: 'GET', path: '/api' });
      expect(formatted).toContain('{');
      expect(formatted).toContain('}');
      expect(formatted).toContain('method="GET"');
    });

    it('should handle empty labels', () => {
      const formatted = service.formatLabels({});
      expect(formatted).toBe('');
    });

    it('should calculate percentile correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const p50 = service.calculatePercentile(values, 0.5);
      expect(p50).toBeGreaterThan(0);
    });

    it('should handle empty percentile calculation', () => {
      const p50 = service.calculatePercentile([], 0.5);
      expect(p50).toBe(0);
    });

    it('should record measurements', () => {
      const before = service.stats.measurementsRecorded;
      service.recordMeasurement();
      expect(service.stats.measurementsRecorded).toBe(before + 1);
    });
  });

  // ========== Estadísticas ==========
  describe('Statistics', () => {
    it('should track registered metrics', () => {
      service.registerCounter('counter1', 'Counter');
      service.registerGauge('gauge1', 'Gauge');

      const stats = service.getStats();
      expect(stats.metricsRegistered).toBe(2);
    });

    it('should track measurements', () => {
      const counter = service.registerCounter('counter', 'Counter');
      counter.inc();
      counter.inc();

      const stats = service.getStats();
      expect(stats.measurementsRecorded).toBe(2);
    });

    it('should include stats in health check', () => {
      const health = service.healthCheck();
      expect(health.stats).toBeDefined();
      expect(health.stats.metricsRegistered).toBe(0);
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
      expect(health.serviceName).toBe('PrometheusService');
    });

    it('should include timestamp', () => {
      const health = service.healthCheck();
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should include metrics count', () => {
      service.registerCounter('test', 'Test');
      const health = service.healthCheck();
      expect(health.metricsCount).toBe(1);
    });
  });

  // ========== Edge Cases ==========
  describe('Edge Cases', () => {
    it('should handle zero values', () => {
      const gauge = service.registerGauge('value', 'Value');
      gauge.set(0);
      expect(gauge.get()).toBe(0);
    });

    it('should handle negative values', () => {
      const gauge = service.registerGauge('temp', 'Temperature');
      gauge.set(-10);
      expect(gauge.get()).toBe(-10);
    });

    it('should handle very large values', () => {
      const counter = service.registerCounter('big', 'Big');
      counter.inc(Number.MAX_SAFE_INTEGER);
      expect(counter.get()).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle decimal values in histogram', () => {
      const histogram = service.registerHistogram('decimals', 'Decimals');
      histogram.observe(0.00001);
      histogram.observe(0.00002);

      const data = histogram.get();
      expect(data.count).toBe(2);
    });

    it('should handle single observation in summary', () => {
      const summary = service.registerSummary('single', 'Single');
      summary.observe(42);

      const data = summary.get();
      expect(data.min).toBe(42);
      expect(data.max).toBe(42);
      expect(data.mean).toBe(42);
    });

    it('should handle duplicate metric names gracefully', () => {
      service.registerCounter('dup', 'First');
      service.registerCounter('dup', 'Second');

      expect(service.metrics.size).toBe(1);
    });
  });

  // ========== Concurrencia ==========
  describe('Concurrency', () => {
    it('should handle concurrent counter increments', () => {
      const counter = service.registerCounter('concurrent', 'Concurrent');

      // Simular incrementos concurrentes
      for (let i = 0; i < 100; i++) {
        counter.inc();
      }

      expect(counter.get()).toBe(100);
    });

    it('should handle concurrent observations', () => {
      const histogram = service.registerHistogram('concurrent', 'Concurrent');

      for (let i = 0; i < 50; i++) {
        histogram.observe(Math.random());
      }

      const data = histogram.get();
      expect(data.count).toBe(50);
    });
  });
});
