import { describe, it, expect, beforeEach } from 'vitest';
import BIDashboardService from '../../src/services/biDashboardService.js';

describe('BIDashboardService', () => {
  let service;

  beforeEach(() => {
    service = new BIDashboardService();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      expect(service.config.refreshInterval).toBe(60000);
      expect(service.config.historicalDays).toBe(90);
    });

    it('should initialize with custom config', () => {
      const custom = new BIDashboardService({ refreshInterval: 30000 });
      expect(custom.config.refreshInterval).toBe(30000);
    });
  });

  describe('Metrics Recording', () => {
    it('should record metric', () => {
      const result = service.recordMetric('hotel', 'occupancy', 85);
      expect(result.value).toBe(85);
      expect(result.category).toBe('hotel');
    });

    it('should retrieve metric', () => {
      service.recordMetric('hotel', 'occupancy', 85);
      const data = service.getMetric('hotel', 'occupancy');
      expect(data.length).toBe(1);
      expect(data[0].value).toBe(85);
    });

    it('should filter by date range', () => {
      const now = Date.now();
      service.recordMetric('hotel', 'occupancy', 85);
      const data = service.getMetric('hotel', 'occupancy', {
        startDate: new Date(now - 1000),
        endDate: new Date(now + 1000)
      });
      expect(data.length).toBe(1);
    });

    it('should limit results', () => {
      for (let i = 0; i < 10; i++) {
        service.recordMetric('hotel', 'occupancy', 80 + i);
      }
      const data = service.getMetric('hotel', 'occupancy', { limit: 5 });
      expect(data.length).toBe(5);
    });
  });

  describe('KPI Management', () => {
    it('should define KPI', () => {
      const kpi = service.defineKPI('occupancy_rate', {
        name: 'Occupancy Rate',
        calculation: () => 85,
        target: 90,
        unit: '%'
      });
      expect(kpi.name).toBe('Occupancy Rate');
    });

    it('should calculate KPI', () => {
      service.defineKPI('occupancy_rate', {
        name: 'Occupancy Rate',
        calculation: () => 85,
        target: 90,
        unit: '%'
      });
      const result = service.calculateKPI('occupancy_rate');
      expect(result.rawValue).toBe(85);
    });

    it('should determine KPI status', () => {
      service.defineKPI('occupancy_rate', {
        name: 'Occupancy Rate',
        calculation: () => 95,
        threshold: { good: 90, warning: 70, critical: 50 }
      });
      const result = service.calculateKPI('occupancy_rate');
      expect(result.status).toBe('good');
    });

    it('should get all KPIs', () => {
      service.defineKPI('kpi1', { name: 'KPI 1', calculation: () => 100 });
      service.defineKPI('kpi2', { name: 'KPI 2', calculation: () => 200 });
      const kpis = service.getAllKPIs();
      expect(kpis.length).toBe(2);
    });
  });

  describe('Widget Management', () => {
    it('should create widget', () => {
      const widget = service.createWidget('widget1', {
        type: 'chart',
        title: 'Occupancy Chart',
        dataSource: () => [1, 2, 3]
      });
      expect(widget.title).toBe('Occupancy Chart');
    });

    it('should get widget with data', () => {
      service.createWidget('widget1', {
        type: 'chart',
        title: 'Test',
        dataSource: () => [1, 2, 3]
      });
      const widget = service.getWidget('widget1');
      expect(widget.data).toEqual([1, 2, 3]);
    });

    it('should cache widget data', () => {
      let callCount = 0;
      service.createWidget('widget1', {
        type: 'chart',
        title: 'Test',
        dataSource: () => {
          callCount++;
          return [1, 2, 3];
        }
      });
      service.getWidget('widget1');
      service.getWidget('widget1');
      expect(callCount).toBe(1); // Cached
    });

    it('should get all widgets', () => {
      service.createWidget('w1', { type: 'chart', title: 'W1', dataSource: () => [] });
      service.createWidget('w2', { type: 'table', title: 'W2', dataSource: () => [] });
      const widgets = service.getAllWidgets();
      expect(widgets.length).toBe(2);
    });
  });

  describe('Dashboard Snapshot', () => {
    it('should get dashboard snapshot', () => {
      service.recordMetric('hotel', 'occupancy', 85);
      service.defineKPI('test_kpi', { name: 'Test', calculation: () => 100 });
      const snapshot = service.getDashboardSnapshot();
      expect(snapshot.kpis).toBeDefined();
      expect(snapshot.widgets).toBeDefined();
      expect(snapshot.summary).toBeDefined();
    });

    it('should include timestamp', () => {
      const snapshot = service.getDashboardSnapshot();
      expect(snapshot.timestamp).toBeDefined();
    });
  });

  describe('Summary Generation', () => {
    it('should generate summary', () => {
      for (let i = 0; i < 30; i++) {
        service.recordMetric('hotel', 'occupancy', 80 + i);
        service.recordMetric('finance', 'revenue', 1000 + i * 10);
        service.recordMetric('bookings', 'total', 5 + i);
      }
      const summary = service.getSummary();
      expect(summary.avgOccupancy).toBeDefined();
      expect(summary.totalRevenue).toBeDefined();
    });
  });

  describe('Drill-Down Analysis', () => {
    it('should drill down by dimension', () => {
      service.recordMetric('bookings', 'total', 10, { roomType: 'deluxe' });
      service.recordMetric('bookings', 'total', 5, { roomType: 'standard' });
      service.recordMetric('bookings', 'total', 8, { roomType: 'deluxe' });

      const result = service.drillDown('bookings', 'total', 'roomType');
      expect(result.length).toBe(2);
      expect(result[0].dimension).toBeDefined();
    });

    it('should aggregate drill-down data', () => {
      service.recordMetric('revenue', 'daily', 100, { source: 'online' });
      service.recordMetric('revenue', 'daily', 200, { source: 'online' });
      const result = service.drillDown('revenue', 'daily', 'source');
      expect(result[0].sum).toBe(300);
      expect(result[0].avg).toBe(150);
    });
  });

  describe('Time Period Comparison', () => {
    it('should compare two periods', () => {
      const now = Date.now();
      service.recordMetric('hotel', 'occupancy', 80);
      service.metrics.get('hotel:occupancy')[0].timestamp = now - 7 * 24 * 60 * 60 * 1000;

      service.recordMetric('hotel', 'occupancy', 90);

      const comparison = service.compareTimePeriods('hotel', 'occupancy',
        { start: new Date(now - 8 * 24 * 60 * 60 * 1000), end: new Date(now - 6 * 24 * 60 * 60 * 1000) },
        { start: new Date(now - 2 * 24 * 60 * 60 * 1000), end: new Date(now) }
      );

      expect(comparison.period1).toBeDefined();
      expect(comparison.change).toBeDefined();
    });
  });

  describe('Historical Trends', () => {
    it('should get trend', () => {
      for (let i = 0; i < 7; i++) {
        service.recordMetric('hotel', 'occupancy', 80 + i);
      }
      const trend = service.getTrend('hotel', 'occupancy', '7d');
      expect(Array.isArray(trend)).toBe(true);
    });

    it('should group trend by day', () => {
      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        const metric = service.recordMetric('hotel', 'occupancy', 80 + i);
        service.metrics.get('hotel:occupancy')[i].timestamp = now - i * 24 * 60 * 60 * 1000;
      }
      const trend = service.getTrend('hotel', 'occupancy', '7d');
      expect(trend.length).toBeGreaterThan(0);
    });
  });

  describe('Seasonal Patterns', () => {
    it('should get seasonal pattern', () => {
      for (let i = 0; i < 12; i++) {
        service.recordMetric('hotel', 'occupancy', 70 + i * 5);
      }
      const pattern = service.getSeasonalPattern('hotel', 'occupancy', 'month');
      expect(Array.isArray(pattern)).toBe(true);
    });
  });

  describe('Alerts System', () => {
    it('should create alert', () => {
      const alert = service.createAlert({
        condition: (value, threshold) => value > threshold,
        message: 'High occupancy',
        threshold: 90,
        category: 'hotel',
        metric: 'occupancy'
      });
      expect(alert.message).toBe('High occupancy');
    });

    it('should trigger alert', () => {
      service.createAlert({
        condition: (value, threshold) => value > threshold,
        message: 'High occupancy',
        threshold: 90,
        category: 'hotel',
        metric: 'occupancy'
      });
      service.recordMetric('hotel', 'occupancy', 95);
      const alerts = service.getActiveAlerts();
      expect(alerts.length).toBe(1);
    });

    it('should dismiss alert', () => {
      const alert = service.createAlert({
        condition: () => true,
        message: 'Test',
        category: 'test',
        metric: 'test'
      });
      service.dismissAlert(alert.id);
      expect(alert.active).toBe(false);
    });
  });

  describe('Data Export', () => {
    it('should export as JSON', () => {
      service.recordMetric('hotel', 'occupancy', 85);
      const exported = service.exportData('hotel', 'occupancy', 'json');
      expect(typeof exported).toBe('string');
      expect(() => JSON.parse(exported)).not.toThrow();
    });

    it('should export as CSV', () => {
      service.recordMetric('hotel', 'occupancy', 85);
      service.recordMetric('hotel', 'occupancy', 90);
      const csv = service.exportData('hotel', 'occupancy', 'csv');
      expect(csv).toContain('timestamp,value,date');
    });
  });

  describe('Report Generation', () => {
    it('should generate report', () => {
      service.recordMetric('hotel', 'occupancy', 85);
      service.recordMetric('finance', 'revenue', 1000);

      const report = service.generateReport({
        title: 'Monthly Report',
        sections: [
          { category: 'hotel', name: 'occupancy', title: 'Occupancy' },
          { category: 'finance', name: 'revenue', title: 'Revenue' }
        ]
      });

      expect(report.title).toBe('Monthly Report');
      expect(report.sections.length).toBe(2);
    });
  });

  describe('Statistics', () => {
    it('should get statistics', () => {
      service.recordMetric('hotel', 'occupancy', 85);
      service.defineKPI('test', { name: 'Test', calculation: () => 1 });
      const stats = service.getStatistics();
      expect(stats.metricsCollected).toBe(1);
      expect(stats.kpisDefined).toBe(1);
    });
  });

  describe('Health Check', () => {
    it('should report healthy', () => {
      service.recordMetric('hotel', 'occupancy', 85);
      const health = service.healthCheck();
      expect(health.status).toBe('healthy');
    });

    it('should report degraded', () => {
      const health = service.healthCheck();
      expect(health.status).toBe('degraded');
    });
  });

  describe('Clear Data', () => {
    it('should clear all data', () => {
      service.recordMetric('hotel', 'occupancy', 85);
      service.defineKPI('test', { name: 'Test', calculation: () => 1 });
      service.clear();
      expect(service.metrics.size).toBe(0);
      expect(service.kpis.size).toBe(0);
    });
  });
});
