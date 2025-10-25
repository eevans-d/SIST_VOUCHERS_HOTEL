import { describe, it, expect, beforeEach } from '@jest/globals';
import DemandForecastingService from '../services/demandForecastingService.js';

describe('DemandForecastingService', () => {
  let forecasting;

  beforeEach(() => {
    forecasting = new DemandForecastingService({
      forecastHorizon: 14,
      trainingDataDays: 90,
      seasonalPeriod: 7,
      confidenceLevel: 0.95,
      minDataPoints: 30,
    });
  });

  // ===== INITIALIZATION TESTS =====

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const service = new DemandForecastingService();
      expect(service.config.forecastHorizon).toBe(30);
      expect(service.config.seasonalPeriod).toBe(7);
    });

    it('should initialize with custom config', () => {
      const service = new DemandForecastingService({
        forecastHorizon: 60,
        seasonalPeriod: 30,
      });
      expect(service.config.forecastHorizon).toBe(60);
      expect(service.config.seasonalPeriod).toBe(30);
    });

    it('should start with empty data', () => {
      expect(forecasting.historicalData.size).toBe(0);
      expect(forecasting.forecasts.size).toBe(0);
    });
  });

  // ===== DATA POINT RECORDING TESTS =====

  describe('Recording Data Points', () => {
    it('should add single data point', () => {
      forecasting.addDataPoint('occupancy', new Date('2025-01-01'), 85);
      expect(forecasting.historicalData.has('occupancy')).toBe(true);
    });

    it('should add data point with number date', () => {
      const timestamp = Date.now();
      forecasting.addDataPoint('occupancy', timestamp, 85);
      const data = forecasting.historicalData.get('occupancy');
      expect(data.values[0]).toBe(85);
    });

    it('should batch add data points', () => {
      const dataPoints = [
        { date: new Date('2025-01-01'), value: 80 },
        { date: new Date('2025-01-02'), value: 85 },
        { date: new Date('2025-01-03'), value: 90 },
      ];
      forecasting.addDataPoints('occupancy', dataPoints);
      const data = forecasting.historicalData.get('occupancy');
      expect(data.values.length).toBe(3);
    });

    it('should sort data points by date', () => {
      forecasting.addDataPoint('occupancy', new Date('2025-01-03'), 90);
      forecasting.addDataPoint('occupancy', new Date('2025-01-01'), 80);
      forecasting.addDataPoint('occupancy', new Date('2025-01-02'), 85);

      const data = forecasting.historicalData.get('occupancy');
      expect(data.values[0]).toBe(80);
      expect(data.values[1]).toBe(85);
      expect(data.values[2]).toBe(90);
    });

    it('should track multiple metrics', () => {
      forecasting.addDataPoint('occupancy', new Date(), 80);
      forecasting.addDataPoint('revenue', new Date(), 1000);
      forecasting.addDataPoint('cancellations', new Date(), 5);

      expect(forecasting.historicalData.size).toBe(3);
    });
  });

  // ===== FORECASTING TESTS =====

  describe('Forecasting', () => {
    beforeEach(() => {
      // Create 60 days of synthetic data with trend and seasonality
      const now = new Date();
      for (let i = 60; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        const trend = (60 - i) * 0.1; // Slight upward trend
        const seasonal = 20 * Math.sin((i % 7) * (Math.PI / 3.5)); // Weekly seasonality
        const noise = Math.random() * 5;
        const value = 70 + trend + seasonal + noise;

        forecasting.addDataPoint('occupancy', date, value);
      }
    });

    it('should generate forecast', () => {
      const forecast = forecasting.forecast('occupancy', 14);
      expect(forecast).toBeDefined();
      expect(forecast.predictions.length).toBe(14);
    });

    it('should return null for insufficient data', () => {
      const service = new DemandForecastingService({ minDataPoints: 100 });
      service.addDataPoint('metric', new Date(), 100);
      const forecast = service.forecast('metric');
      expect(forecast).toBeNull();
    });

    it('should generate confidence intervals', () => {
      const forecast = forecasting.forecast('occupancy', 14);
      expect(forecast.intervals.length).toBe(14);
      forecast.intervals.forEach(interval => {
        expect(interval.lower).toBeLessThanOrEqual(interval.upper);
      });
    });

    it('should forecast occupancy', () => {
      const forecast = forecasting.forecastOccupancy('deluxe', 14);
      expect(forecast).toBeDefined();
      expect(forecast.metricName).toContain('occupancy');
    });

    it('should forecast revenue', () => {
      for (let i = 30; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        forecasting.addDataPoint('revenue', date, 5000 + Math.random() * 1000);
      }

      const forecast = forecasting.forecastRevenue(14);
      expect(forecast).toBeDefined();
    });
  });

  // ===== SMOOTHING ALGORITHM TESTS =====

  describe('Smoothing Algorithms', () => {
    beforeEach(() => {
      const values = [100, 102, 101, 103, 104, 102, 105, 106, 104];
      values.forEach((v, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (9 - i));
        forecasting.addDataPoint('metric', date, v);
      });
    });

    it('should perform simple exponential smoothing', () => {
      const values = [100, 102, 101, 103];
      const smoothed = forecasting._simpleExponentialSmoothing(values);
      expect(smoothed.length).toBe(values.length);
      expect(smoothed[0]).toBe(100);
    });

    it('should perform double exponential smoothing', () => {
      const values = [100, 102, 101, 103, 105, 104, 106];
      const { level, trend } = forecasting._doubleExponentialSmoothing(values);
      expect(level.length).toBe(values.length);
      expect(trend.length).toBe(values.length);
    });

    it('should calculate seasonal indices', () => {
      const values = [70, 80, 75, 85, 70, 80, 75, 85, 70, 80];
      const indices = forecasting._calculateSeasonalIndices(values, 4);
      expect(indices.length).toBe(4);
      expect(indices.every(idx => idx > 0)).toBe(true);
    });
  });

  // ===== TREND ANALYSIS TESTS =====

  describe('Trend Analysis', () => {
    it('should detect increasing trend', () => {
      for (let i = 0; i < 30; i++) {
        forecasting.addDataPoint('metric', new Date(Date.now() - i * 86400000), 100 + i * 2);
      }

      const trend = forecasting.getTrend('metric');
      expect(trend.direction).toBe('increasing');
      expect(parseFloat(trend.changePercent)).toBeGreaterThan(0);
    });

    it('should detect decreasing trend', () => {
      for (let i = 0; i < 30; i++) {
        forecasting.addDataPoint('metric', new Date(Date.now() - i * 86400000), 100 - i * 2);
      }

      const trend = forecasting.getTrend('metric');
      expect(trend.direction).toBe('decreasing');
      expect(parseFloat(trend.changePercent)).toBeLessThan(0);
    });

    it('should calculate momentum', () => {
      for (let i = 0; i < 30; i++) {
        forecasting.addDataPoint('metric', new Date(Date.now() - i * 86400000), 100 + i * 5);
      }

      const trend = forecasting.getTrend('metric');
      expect(trend.momentum).toBeGreaterThan(0);
    });
  });

  // ===== ANOMALY DETECTION TESTS =====

  describe('Forecast Anomaly Detection', () => {
    beforeEach(() => {
      for (let i = 60; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        forecasting.addDataPoint('occupancy', date, 80 + Math.random() * 10);
      }
      forecasting.forecast('occupancy', 7);
    });

    it('should detect anomalies outside confidence interval', () => {
      const anomaly = forecasting.detectForecastAnomaly('occupancy', 150);
      expect(anomaly).toBeDefined();
      expect(anomaly.isAnomalous).toBe(true);
    });

    it('should not flag normal values as anomalies', () => {
      const anomaly = forecasting.detectForecastAnomaly('occupancy', 85);
      expect(anomaly).toBeDefined();
      expect(anomaly.isAnomalous).toBe(false);
    });

    it('should calculate deviation percent', () => {
      const anomaly = forecasting.detectForecastAnomaly('occupancy', 120);
      expect(anomaly.deviationPercent).toBeDefined();
      expect(typeof parseFloat(anomaly.deviationPercent)).toBe('number');
    });

    it('should assign severity level', () => {
      const anomaly = forecasting.detectForecastAnomaly('occupancy', 200);
      expect(['low', 'medium', 'high', 'critical']).toContain(anomaly.severity);
    });
  });

  // ===== ACCURACY TESTS =====

  describe('Forecast Accuracy', () => {
    beforeEach(() => {
      for (let i = 60; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        forecasting.addDataPoint('metric', date, 100 + Math.random() * 20);
      }
      forecasting.forecast('metric', 14);
    });

    it('should calculate MAPE', () => {
      const actualValues = [105, 103, 107, 102];
      const accuracy = forecasting.calculateAccuracy('metric', actualValues);
      expect(accuracy.mape).toBeDefined();
      expect(parseFloat(accuracy.mape)).toBeGreaterThanOrEqual(0);
    });

    it('should calculate RMSE', () => {
      const actualValues = [105, 103, 107, 102];
      const accuracy = forecasting.calculateAccuracy('metric', actualValues);
      expect(accuracy.rmse).toBeDefined();
      expect(parseFloat(accuracy.rmse)).toBeGreaterThanOrEqual(0);
    });

    it('should calculate accuracy percentage', () => {
      const actualValues = [105, 103, 107, 102];
      const accuracy = forecasting.calculateAccuracy('metric', actualValues);
      expect(accuracy.accuracy).toBeDefined();
      expect(parseFloat(accuracy.accuracy)).toBeLessThanOrEqual(100);
    });
  });

  // ===== INSIGHTS TESTS =====

  describe('Demand Insights', () => {
    beforeEach(() => {
      for (let i = 60; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        // Simulate occupancy with weekly pattern
        const seasonal = 20 * Math.sin((i % 7) * (Math.PI / 3.5));
        const value = 75 + seasonal + Math.random() * 5;
        forecasting.addDataPoint('occupancy:deluxe', date, value);
      }
    });

    it('should get demand insights', () => {
      const insights = forecasting.getDemandInsights('deluxe');
      expect(insights).toBeDefined();
      expect(insights.roomType).toBe('deluxe');
    });

    it('should calculate occupancy statistics', () => {
      const insights = forecasting.getDemandInsights('deluxe');
      expect(insights.averageOccupancy).toBeDefined();
      expect(insights.medianOccupancy).toBeDefined();
      expect(insights.minOccupancy).toBeDefined();
      expect(insights.maxOccupancy).toBeDefined();
    });

    it('should identify peak periods', () => {
      const insights = forecasting.getDemandInsights('deluxe');
      expect(insights.peakPeriodsCount).toBeGreaterThanOrEqual(0);
      expect(insights.lowPeriodsCount).toBeGreaterThanOrEqual(0);
    });

    it('should calculate volatility', () => {
      const insights = forecasting.getDemandInsights('deluxe');
      expect(insights.volatility).toBeDefined();
      expect(parseFloat(insights.volatility)).toBeGreaterThanOrEqual(0);
    });
  });

  // ===== RESOURCE RECOMMENDATION TESTS =====

  describe('Resource Recommendations', () => {
    beforeEach(() => {
      for (let i = 30; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        forecasting.addDataPoint('occupancy', date, 50 + Math.random() * 40);
      }
      forecasting.forecast('occupancy', 14);
    });

    it('should get resource recommendation', () => {
      const rec = forecasting.getResourceRecommendation('occupancy', 1.5);
      expect(rec).toBeDefined();
      expect(rec.recommendedResources).toBeDefined();
    });

    it('should recommend minimum resources', () => {
      const rec = forecasting.getResourceRecommendation('occupancy', 2);
      expect(rec.recommendedResources.minimum).toBeGreaterThan(0);
    });

    it('should recommend average resources', () => {
      const rec = forecasting.getResourceRecommendation('occupancy', 2);
      expect(rec.recommendedResources.average).toBeGreaterThan(0);
      expect(rec.recommendedResources.average).toBeGreaterThanOrEqual(
        rec.recommendedResources.minimum
      );
    });

    it('should recommend peak resources', () => {
      const rec = forecasting.getResourceRecommendation('occupancy', 2);
      expect(rec.recommendedResources.peak).toBeGreaterThan(0);
      expect(rec.recommendedResources.peak).toBeGreaterThanOrEqual(
        rec.recommendedResources.average
      );
    });
  });

  // ===== FORECAST RETRIEVAL TESTS =====

  describe('Forecast Retrieval', () => {
    beforeEach(() => {
      for (let i = 30; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        forecasting.addDataPoint('metric', date, 100 + Math.random() * 20);
      }
      forecasting.forecast('metric', 14);
    });

    it('should get all forecasts', () => {
      const allForecasts = forecasting.getAllForecasts();
      expect(Array.isArray(allForecasts)).toBe(true);
      expect(allForecasts.length).toBeGreaterThan(0);
    });

    it('should get forecast for specific date', () => {
      const date = new Date();
      date.setDate(date.getDate() + 5);

      const forecast = forecasting.getForecastForDate('metric', date);
      expect(forecast).toBeDefined();
      expect(forecast.prediction).toBeGreaterThan(0);
    });

    it('should return null for date without forecast', () => {
      const date = new Date();
      date.setDate(date.getDate() + 100);

      const forecast = forecasting.getForecastForDate('metric', date);
      expect(forecast).toBeNull();
    });
  });

  // ===== EXPORT TESTS =====

  describe('Export Functionality', () => {
    beforeEach(() => {
      for (let i = 30; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        forecasting.addDataPoint('metric', date, 100 + Math.random() * 20);
      }
      forecasting.forecast('metric', 7);
    });

    it('should export forecast as CSV', () => {
      const csv = forecasting.exportForecastAsCsv('metric');
      expect(typeof csv).toBe('string');
      expect(csv).toContain('Date');
      expect(csv).toContain('Prediction');
    });

    it('should include all columns in CSV', () => {
      const csv = forecasting.exportForecastAsCsv('metric');
      const lines = csv.split('\n');
      expect(lines[0]).toContain('Date');
      expect(lines[0]).toContain('Prediction');
      expect(lines[0]).toContain('Lower_Bound');
      expect(lines[0]).toContain('Upper_Bound');
    });

    it('should return null for non-existent metric', () => {
      const csv = forecasting.exportForecastAsCsv('nonexistent');
      expect(csv).toBeNull();
    });
  });

  // ===== HEALTH CHECK TESTS =====

  describe('Health Check', () => {
    it('should report healthy status', () => {
      forecasting.addDataPoint('metric', new Date(), 100);
      const health = forecasting.healthCheck();
      expect(health.status).toBe('healthy');
    });

    it('should track metrics count', () => {
      forecasting.addDataPoint('metric1', new Date(), 100);
      forecasting.addDataPoint('metric2', new Date(), 200);
      const health = forecasting.healthCheck();
      expect(health.metricsTracked).toBe(2);
    });

    it('should track data points', () => {
      for (let i = 0; i < 50; i++) {
        forecasting.addDataPoint('metric', new Date(Date.now() - i * 86400000), 100 + i);
      }
      const health = forecasting.healthCheck();
      expect(health.totalDataPoints).toBeGreaterThan(0);
    });
  });

  // ===== DATA MANAGEMENT TESTS =====

  describe('Data Management', () => {
    it('should clear all data', () => {
      forecasting.addDataPoint('metric', new Date(), 100);
      forecasting.forecast('metric', 14);

      expect(forecasting.historicalData.size).toBeGreaterThan(0);
      forecasting.clear();
      expect(forecasting.historicalData.size).toBe(0);
      expect(forecasting.forecasts.size).toBe(0);
    });
  });

  // ===== EDGE CASES =====

  describe('Edge Cases', () => {
    it('should handle zero values', () => {
      for (let i = 30; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        forecasting.addDataPoint('metric', date, 0);
      }

      const forecast = forecasting.forecast('metric', 7);
      expect(forecast).toBeDefined();
    });

    it('should handle very large values', () => {
      for (let i = 30; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        forecasting.addDataPoint('metric', date, 1000000);
      }

      const forecast = forecasting.forecast('metric', 7);
      expect(forecast).toBeDefined();
      expect(forecast.predictions.every(p => p > 0)).toBe(true);
    });

    it('should handle high volatility', () => {
      for (let i = 30; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const randomValue = Math.random() * 1000;
        forecasting.addDataPoint('metric', date, randomValue);
      }

      const forecast = forecasting.forecast('metric', 7);
      expect(forecast).toBeDefined();
    });

    it('should handle constant values', () => {
      for (let i = 30; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        forecasting.addDataPoint('metric', date, 100);
      }

      const forecast = forecasting.forecast('metric', 7);
      expect(forecast).toBeDefined();
      // All predictions should be similar
      expect(forecast.predictions.every(p => Math.abs(p - 100) < 1)).toBe(true);
    });
  });

  // ===== CONCURRENCY TESTS =====

  describe('Concurrent Operations', () => {
    it('should handle concurrent data additions', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve(
            forecasting.addDataPoint(`metric${i % 3}`, new Date(), Math.random() * 100)
          )
        );
      }

      await Promise.all(promises);
      expect(forecasting.historicalData.size).toBeLessThanOrEqual(3);
    });

    it('should handle concurrent forecasting', async () => {
      for (let i = 30; i >= 0; i--) {
        forecasting.addDataPoint('metric1', new Date(Date.now() - i * 86400000), 100 + i);
        forecasting.addDataPoint('metric2', new Date(Date.now() - i * 86400000), 200 + i);
      }

      const promises = [
        Promise.resolve(forecasting.forecast('metric1', 7)),
        Promise.resolve(forecasting.forecast('metric2', 7)),
      ];

      const results = await Promise.all(promises);
      expect(results.every(r => r !== null)).toBe(true);
    });
  });
});
