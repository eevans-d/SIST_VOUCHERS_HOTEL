import { describe, it, expect, beforeEach } from '@jest/globals';
import AnomalyDetectionService from '../services/anomalyDetectionService.js';

describe('AnomalyDetectionService', () => {
  let anomalyService;

  beforeEach(() => {
    anomalyService = new AnomalyDetectionService({
      minDataPoints: 10,
      zScoreThreshold: 2.5,
      sensitivityLevel: 'medium',
    });
  });

  // ===== INITIALIZATION TESTS =====

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const service = new AnomalyDetectionService();
      expect(service.config.minDataPoints).toBe(30);
      expect(service.config.zScoreThreshold).toBe(2.5);
      expect(service.config.sensitivityLevel).toBe('medium');
    });

    it('should initialize with custom config', () => {
      const service = new AnomalyDetectionService({
        minDataPoints: 20,
        sensitivityLevel: 'high',
      });
      expect(service.config.minDataPoints).toBe(20);
      expect(service.config.sensitivityLevel).toBe('high');
    });

    it('should initialize with empty storage', () => {
      expect(anomalyService.metrics.size).toBe(0);
      expect(anomalyService.baselines.size).toBe(0);
      expect(anomalyService.anomalies.length).toBe(0);
    });
  });

  // ===== METRIC RECORDING TESTS =====

  describe('Recording Metrics', () => {
    it('should record single metric', () => {
      const result = anomalyService.recordMetric('response_time', 150);
      expect(result.metricName).toBe('response_time');
      expect(result.value).toBe(150);
      expect(result.isAnomaly).toBe(false);
    });

    it('should record multiple metrics', () => {
      anomalyService.recordMetric('cpu_usage', 45);
      anomalyService.recordMetric('memory_usage', 78);
      expect(anomalyService.metrics.size).toBe(2);
    });

    it('should batch record metrics', () => {
      const metrics = [
        { metricName: 'metric1', value: 100 },
        { metricName: 'metric2', value: 200 },
        { metricName: 'metric3', value: 300 },
      ];
      const results = anomalyService.recordMetrics(metrics);
      expect(results.length).toBe(3);
      expect(anomalyService.metrics.size).toBe(3);
    });

    it('should store metadata with metric', () => {
      anomalyService.recordMetric('response_time', 150, {
        endpoint: '/api/orders',
        method: 'GET',
      });
      const metric = anomalyService.metrics.get('response_time');
      expect(metric.metadata.endpoint).toBe('/api/orders');
    });

    it('should update last value and timestamp', () => {
      anomalyService.recordMetric('cpu', 50);
      anomalyService.recordMetric('cpu', 60);
      const metric = anomalyService.metrics.get('cpu');
      expect(metric.lastValue).toBe(60);
      expect(metric.lastTimestamp).toBeDefined();
    });
  });

  // ===== BASELINE LEARNING TESTS =====

  describe('Baseline Learning', () => {
    it('should learn baseline after minimum data points', () => {
      const values = [100, 102, 98, 101, 99, 103, 97, 100, 102, 98];
      values.forEach(v => anomalyService.recordMetric('latency', v));

      const baseline = anomalyService.getBaseline('latency');
      expect(baseline).toBeDefined();
      expect(baseline.mean).toBeCloseTo(100, 1);
      expect(baseline.stddev).toBeGreaterThan(0);
    });

    it('should not learn baseline before minimum data points', () => {
      anomalyService.recordMetric('metric', 100);
      anomalyService.recordMetric('metric', 101);
      const baseline = anomalyService.getBaseline('metric');
      expect(baseline).toBeNull();
    });

    it('should set manual baseline', () => {
      anomalyService.setBaseline('metric', 100, 10);
      const baseline = anomalyService.getBaseline('metric');
      expect(baseline.mean).toBe(100);
      expect(baseline.stddev).toBe(10);
      expect(baseline.manual).toBe(true);
    });

    it('should update baseline with new data', () => {
      const values1 = [100, 102, 98, 101, 99, 103, 97, 100, 102, 98];
      values1.forEach(v => anomalyService.recordMetric('metric', v));
      const baseline1 = anomalyService.getBaseline('metric');

      // Record more values
      const values2 = [150, 152, 148, 151];
      values2.forEach(v => anomalyService.recordMetric('metric', v));
      const baseline2 = anomalyService.getBaseline('metric');

      expect(baseline2.mean).toBeGreaterThan(baseline1.mean);
    });
  });

  // ===== ANOMALY DETECTION TESTS =====

  describe('Anomaly Detection', () => {
    beforeEach(() => {
      // Establish baseline: mean ≈ 100, stddev ≈ 2
      const normalValues = [98, 99, 100, 101, 102, 98, 100, 101, 99, 100];
      normalValues.forEach(v => anomalyService.recordMetric('response_time', v));
    });

    it('should detect high value anomaly', () => {
      const result = anomalyService.recordMetric('response_time', 200);
      expect(result.isAnomaly).toBe(true);
    });

    it('should detect low value anomaly', () => {
      const result = anomalyService.recordMetric('response_time', 10);
      expect(result.isAnomaly).toBe(true);
    });

    it('should not detect normal value as anomaly', () => {
      const result = anomalyService.recordMetric('response_time', 101);
      expect(result.isAnomaly).toBe(false);
    });

    it('should calculate correct Z-score', () => {
      const zScore = anomalyService._calculateZScore(130, 100, 10);
      expect(zScore).toBe(3.0);
    });

    it('should handle zero stddev', () => {
      const zScore = anomalyService._calculateZScore(100, 100, 0);
      expect(zScore).toBe(0);
    });
  });

  // ===== SENSITIVITY TESTS =====

  describe('Sensitivity Levels', () => {
    beforeEach(() => {
      const values = [100, 101, 99, 102, 98, 100, 101, 100, 99, 102];
      values.forEach(v => anomalyService.recordMetric('metric', v));
    });

    it('should detect anomaly with high sensitivity', () => {
      const service = new AnomalyDetectionService({
        minDataPoints: 10,
        sensitivityLevel: 'high',
      });
      const values = [100, 101, 99, 102, 98, 100, 101, 100, 99, 102];
      values.forEach(v => service.recordMetric('metric', v));

      const result = service.recordMetric('metric', 120);
      expect(result.isAnomaly).toBe(true);
    });

    it('should require higher value with low sensitivity', () => {
      const service = new AnomalyDetectionService({
        minDataPoints: 10,
        sensitivityLevel: 'low',
      });
      const values = [100, 101, 99, 102, 98, 100, 101, 100, 99, 102];
      values.forEach(v => service.recordMetric('metric', v));

      const result = service.recordMetric('metric', 120);
      expect(result.isAnomaly).toBe(false);
    });
  });

  // ===== SPIKE DETECTION TESTS =====

  describe('Traffic Spike Detection', () => {
    beforeEach(() => {
      const values = Array(15).fill(100);
      values.forEach(v => anomalyService.recordMetric('requests', v));
    });

    it('should detect traffic spike', () => {
      const spike = anomalyService.detectTrafficSpike('requests', 2.0);
      expect(spike).toBeNull();

      anomalyService.recordMetric('requests', 250);
      const spike2 = anomalyService.detectTrafficSpike('requests', 2.0);
      expect(spike2).toBeDefined();
      expect(spike2.spikeRatio).toBe('2.50');
    });

    it('should calculate spike ratio correctly', () => {
      anomalyService.recordMetric('requests', 300);
      const spike = anomalyService.detectTrafficSpike('requests', 2.0);
      expect(spike.severity).toBe('high');
      expect(parseFloat(spike.spikeRatio)).toBeGreaterThan(2.0);
    });

    it('should not flag normal traffic as spike', () => {
      anomalyService.recordMetric('requests', 110);
      const spike = anomalyService.detectTrafficSpike('requests', 2.0);
      expect(spike).toBeNull();
    });
  });

  // ===== PERFORMANCE DEGRADATION TESTS =====

  describe('Performance Degradation Detection', () => {
    beforeEach(() => {
      const values = Array(15).fill(50);
      values.forEach(v => anomalyService.recordMetric('latency', v));
    });

    it('should detect performance degradation', () => {
      anomalyService.recordMetric('latency', 100);
      const degradation = anomalyService.detectPerformanceDegradation('latency', 1.5);
      expect(degradation).toBeDefined();
      expect(degradation.degradationFactor).toBe('2.00');
    });

    it('should calculate degradation factor', () => {
      anomalyService.recordMetric('latency', 150);
      const degradation = anomalyService.detectPerformanceDegradation('latency', 1.5);
      expect(parseFloat(degradation.degradationFactor)).toBeGreaterThan(1.5);
    });

    it('should not flag minor increases as degradation', () => {
      anomalyService.recordMetric('latency', 60);
      const degradation = anomalyService.detectPerformanceDegradation('latency', 1.5);
      expect(degradation).toBeNull();
    });
  });

  // ===== ERROR RATE ANOMALY TESTS =====

  describe('Error Rate Anomaly Detection', () => {
    beforeEach(() => {
      const values = Array(15).fill(2);
      values.forEach(v => anomalyService.recordMetric('error_rate', v));
    });

    it('should detect error rate spike', () => {
      anomalyService.recordMetric('error_rate', 15);
      const anomaly = anomalyService.detectErrorRateAnomaly('error_rate');
      expect(anomaly).toBeDefined();
      expect(anomaly.severity).toBe('high');
    });

    it('should calculate error increase', () => {
      anomalyService.recordMetric('error_rate', 20);
      const anomaly = anomalyService.detectErrorRateAnomaly('error_rate');
      expect(parseFloat(anomaly.errorIncrease)).toBeGreaterThan(10);
    });
  });

  // ===== ALERT MANAGEMENT TESTS =====

  describe('Alert Management', () => {
    beforeEach(() => {
      const values = [100, 101, 99, 102, 98, 100, 101, 100, 99, 102];
      values.forEach(v => anomalyService.recordMetric('metric', v));
    });

    it('should generate alert for anomaly', () => {
      anomalyService.recordMetric('metric', 300);
      expect(anomalyService.alerts.length).toBeGreaterThan(0);
    });

    it('should set alert severity', () => {
      anomalyService.recordMetric('metric', 300);
      const alert = anomalyService.alerts[0];
      expect(['low', 'medium', 'high', 'critical']).toContain(alert.severity);
    });

    it('should acknowledge alert', () => {
      anomalyService.recordMetric('metric', 300);
      const alert = anomalyService.alerts[0];
      anomalyService.acknowledgeAlert(alert.id, 'Investigated');
      expect(alert.acknowledged).toBe(true);
      expect(alert.acknowledgedComment).toBe('Investigated');
    });

    it('should get active alerts', () => {
      anomalyService.recordMetric('metric', 300);
      const activeAlerts = anomalyService.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);
      expect(activeAlerts[0].acknowledged).toBe(false);
    });

    it('should filter acknowledged alerts', () => {
      anomalyService.recordMetric('metric', 300);
      const alert = anomalyService.alerts[0];
      anomalyService.acknowledgeAlert(alert.id);
      const activeAlerts = anomalyService.getActiveAlerts();
      expect(activeAlerts.length).toBe(0);
    });
  });

  // ===== QUERY AND AGGREGATION TESTS =====

  describe('Queries and Aggregations', () => {
    beforeEach(() => {
      const values = [100, 101, 99, 102, 98, 100, 101, 100, 99, 102, 300];
      values.forEach(v => anomalyService.recordMetric('metric', v));
    });

    it('should get anomalies for metric', () => {
      const anomalies = anomalyService.getAnomalies('metric');
      expect(anomalies.length).toBeGreaterThan(0);
    });

    it('should get anomalies by severity', () => {
      const criticalAnomalies = anomalyService.getAnomaliesBySeverity('critical');
      expect(Array.isArray(criticalAnomalies)).toBe(true);
    });

    it('should get active metrics', () => {
      anomalyService.recordMetric('metric1', 100);
      anomalyService.recordMetric('metric2', 200);
      const metrics = anomalyService.getActiveMetrics();
      expect(metrics.length).toBeGreaterThanOrEqual(2);
    });

    it('should calculate metric statistics', () => {
      const stats = anomalyService.getMetricStats('metric');
      expect(stats.count).toBeGreaterThan(0);
      expect(stats.min).toBeLessThanOrEqual(stats.max);
      expect(parseFloat(stats.mean)).toBeGreaterThan(0);
    });

    it('should analyze metric trend', () => {
      const trend = anomalyService.analyzeMetricTrend('metric');
      expect(trend).toBeDefined();
      expect(['increasing', 'decreasing']).toContain(trend.trendDirection);
    });
  });

  // ===== DATA CLEANUP TESTS =====

  describe('Data Management', () => {
    it('should clear metric data', () => {
      anomalyService.recordMetric('metric', 100);
      expect(anomalyService.metrics.size).toBe(1);
      anomalyService.clearMetric('metric');
      expect(anomalyService.metrics.size).toBe(0);
    });

    it('should cleanup old data points', () => {
      // Mock retention
      const service = new AnomalyDetectionService({ retentionHours: 0.001 });
      service.recordMetric('metric', 100);
      const metric = service.metrics.get('metric');
      expect(metric.values.length).toBe(1);
    });
  });

  // ===== EXPORT TESTS =====

  describe('Export and Reporting', () => {
    beforeEach(() => {
      const values = [100, 101, 99, 102, 98, 100, 101, 100, 99, 102];
      values.forEach(v => anomalyService.recordMetric('metric', v));
      anomalyService.recordMetric('metric', 300);
    });

    it('should export anomalies report', () => {
      const report = anomalyService.exportAnomaliesReport();
      expect(report.totalAnomalies).toBeGreaterThan(0);
      expect(report.metricsMonitored).toBeGreaterThan(0);
    });

    it('should include severity breakdown', () => {
      const report = anomalyService.exportAnomaliesReport();
      expect(report.anomaliesBySeverity).toBeDefined();
      expect(report.anomaliesBySeverity.critical).toBeGreaterThanOrEqual(0);
    });

    it('should export as CSV', () => {
      const csv = anomalyService.exportAnomaliesReport('csv');
      expect(typeof csv).toBe('string');
      expect(csv).toContain('Metric');
      expect(csv).toContain('Severity');
    });
  });

  // ===== HEALTH CHECK TESTS =====

  describe('Health Check', () => {
    beforeEach(() => {
      anomalyService.recordMetric('metric', 100);
    });

    it('should report healthy status', () => {
      const health = anomalyService.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.metricsTracked).toBeGreaterThanOrEqual(1);
    });

    it('should include configuration', () => {
      const health = anomalyService.healthCheck();
      expect(health.config.sensitivityLevel).toBeDefined();
      expect(health.config.zScoreThreshold).toBeDefined();
    });

    it('should track active alerts count', () => {
      const health = anomalyService.healthCheck();
      expect(typeof health.unacknowledgedAlerts).toBe('number');
    });
  });

  // ===== EDGE CASES =====

  describe('Edge Cases', () => {
    it('should handle empty metric name', () => {
      const result = anomalyService.recordMetric('', 100);
      expect(result.value).toBe(100);
    });

    it('should handle zero value', () => {
      const result = anomalyService.recordMetric('metric', 0);
      expect(result.value).toBe(0);
    });

    it('should handle negative values', () => {
      const result = anomalyService.recordMetric('metric', -100);
      expect(result.value).toBe(-100);
    });

    it('should handle very large values', () => {
      const result = anomalyService.recordMetric('metric', 999999999);
      expect(result.value).toBe(999999999);
    });

    it('should handle null baseline gracefully', () => {
      const spike = anomalyService.detectTrafficSpike('nonexistent');
      expect(spike).toBeNull();
    });

    it('should handle multiple anomalies per metric', () => {
      const values = [100, 101, 99, 102, 98, 100, 101, 100, 99, 102];
      values.forEach(v => anomalyService.recordMetric('metric', v));

      anomalyService.recordMetric('metric', 300);
      anomalyService.recordMetric('metric', 350);

      const anomalies = anomalyService.getAnomalies('metric');
      expect(anomalies.length).toBeGreaterThan(1);
    });

    it('should limit stored alerts', () => {
      const service = new AnomalyDetectionService();
      const values = [100, 101, 99, 102, 98, 100, 101, 100, 99, 102];
      values.forEach(v => service.recordMetric('metric', v));

      // Generate many alerts
      for (let i = 0; i < 1500; i++) {
        service.recordMetric('metric', 300);
      }

      expect(service.alerts.length).toBeLessThanOrEqual(1000);
    });
  });

  // ===== CONCURRENCY TESTS =====

  describe('Concurrent Operations', () => {
    it('should handle concurrent metric recording', async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve(
            anomalyService.recordMetric(`metric${i % 5}`, Math.random() * 200)
          )
        );
      }
      await Promise.all(promises);
      expect(anomalyService.metrics.size).toBeLessThanOrEqual(5);
    });

    it('should handle rapid baseline updates', () => {
      for (let i = 0; i < 50; i++) {
        anomalyService.recordMetric('metric', 100 + Math.random() * 10);
      }
      const baseline = anomalyService.getBaseline('metric');
      expect(baseline).toBeDefined();
      expect(baseline.mean).toBeCloseTo(105, 0);
    });
  });
});
