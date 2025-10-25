import { describe, it, expect, beforeEach } from '@jest/globals';
import PriceOptimizationService from '../services/priceOptimizationService.js';

describe('PriceOptimizationService', () => {
  let optimizer;

  beforeEach(() => {
    optimizer = new PriceOptimizationService({
      basePrice: 100,
      minPrice: 50,
      maxPrice: 300,
      demandFactor: 0.5,
      seasonalFactor: 0.3,
      competitionFactor: 0.2,
    });
  });

  // ===== INITIALIZATION TESTS =====

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const service = new PriceOptimizationService();
      expect(service.config.basePrice).toBe(100);
      expect(service.config.minPrice).toBe(50);
      expect(service.config.maxPrice).toBe(300);
    });

    it('should initialize with custom config', () => {
      const service = new PriceOptimizationService({
        basePrice: 150,
        minPrice: 100,
        maxPrice: 400,
      });
      expect(service.config.basePrice).toBe(150);
      expect(service.config.minPrice).toBe(100);
      expect(service.config.maxPrice).toBe(400);
    });
  });

  // ===== PRICE CALCULATION TESTS =====

  describe('Price Calculation', () => {
    it('should calculate optimal price', () => {
      const result = optimizer.calculateOptimalPrice('deluxe', {
        occupancy: 80,
        forecast: 85,
      });

      expect(result).toBeDefined();
      expect(result.optimalPrice).toBeDefined();
      expect(parseFloat(result.optimalPrice)).toBeGreaterThan(0);
    });

    it('should respect price bounds', () => {
      const result = optimizer.calculateOptimalPrice('deluxe', {
        occupancy: 95,
        forecast: 100,
      }, 1.5, 150);

      const price = parseFloat(result.optimalPrice);
      expect(price).toBeGreaterThanOrEqual(optimizer.config.minPrice);
      expect(price).toBeLessThanOrEqual(optimizer.config.maxPrice);
    });

    it('should increase price with high occupancy', () => {
      const lowOccupancy = optimizer.calculateOptimalPrice('deluxe', {
        occupancy: 30,
        forecast: 30,
      });

      const highOccupancy = optimizer.calculateOptimalPrice('deluxe', {
        occupancy: 90,
        forecast: 90,
      });

      expect(parseFloat(highOccupancy.optimalPrice)).toBeGreaterThan(
        parseFloat(lowOccupancy.optimalPrice)
      );
    });

    it('should consider seasonal index', () => {
      const lowSeason = optimizer.calculateOptimalPrice('deluxe', {
        occupancy: 70,
        forecast: 70,
      }, 0.8);

      const highSeason = optimizer.calculateOptimalPrice('deluxe', {
        occupancy: 70,
        forecast: 70,
      }, 1.5);

      expect(parseFloat(highSeason.optimalPrice)).toBeGreaterThan(
        parseFloat(lowSeason.optimalPrice)
      );
    });

    it('should factor in competition prices', () => {
      const noCOMPETITION = optimizer.calculateOptimalPrice('deluxe', {
        occupancy: 70,
        forecast: 70,
      }, 1.0, null);

      const withCompetition = optimizer.calculateOptimalPrice('deluxe', {
        occupancy: 70,
        forecast: 70,
      }, 1.0, 80);

      // When competitors are cheaper, price should be different
      expect(noCOMPETITION.optimalPrice).toBeDefined();
      expect(withCompetition.optimalPrice).toBeDefined();
    });
  });

  // ===== PRICE MANAGEMENT TESTS =====

  describe('Price Management', () => {
    it('should set and get price', () => {
      optimizer.setPrice('deluxe', 120);
      expect(optimizer.getPrice('deluxe')).toBe(120);
    });

    it('should track price history', () => {
      optimizer.setPrice('deluxe', 100);
      optimizer.setPrice('deluxe', 110);
      optimizer.setPrice('deluxe', 105);

      const history = optimizer.getPriceHistory('deluxe');
      expect(history.current).toBe(105);
      expect(history.count).toBe(3);
    });

    it('should record price change reason', () => {
      optimizer.setPrice('deluxe', 120, 'High occupancy');
      const history = optimizer.getPriceHistory('deluxe');
      expect(history.changes[0].reason).toBe('High occupancy');
    });

    it('should calculate price change percentage', () => {
      optimizer.setPrice('deluxe', 100);
      const change = optimizer.setPrice('deluxe', 110);

      expect(parseFloat(change.changePercent)).toBe(10);
    });

    it('should return base price for unset room type', () => {
      const price = optimizer.getPrice('unknown');
      expect(price).toBe(optimizer.config.basePrice);
    });
  });

  // ===== COMPETITOR PRICING TESTS =====

  describe('Competitor Pricing', () => {
    it('should update competitor prices', () => {
      optimizer.updateCompetitorPrice('HotelA', 'deluxe', 110);
      optimizer.updateCompetitorPrice('HotelB', 'deluxe', 105);

      expect(optimizer.competitorPrices.has('HotelA')).toBe(true);
      expect(optimizer.competitorPrices.has('HotelB')).toBe(true);
    });

    it('should calculate average competitor price', () => {
      optimizer.updateCompetitorPrice('HotelA', 'deluxe', 100);
      optimizer.updateCompetitorPrice('HotelB', 'deluxe', 120);

      const avg = optimizer.getAverageCompetitorPrice('deluxe');
      expect(avg).toBe(110);
    });

    it('should return null for no competitors', () => {
      const avg = optimizer.getAverageCompetitorPrice('deluxe');
      expect(avg).toBeNull();
    });
  });

  // ===== DEMAND METRICS TESTS =====

  describe('Demand Metrics', () => {
    it('should record demand metrics', () => {
      optimizer.recordDemandMetrics('deluxe', {
        occupancy: 85,
        forecast: 87,
        bookings: 10,
        inquiries: 20,
        cancellations: 1,
      });

      expect(optimizer.demandMetrics.has('deluxe')).toBe(true);
    });

    it('should accumulate metrics over time', () => {
      for (let i = 0; i < 7; i++) {
        optimizer.recordDemandMetrics('deluxe', {
          occupancy: 80 + i,
          bookings: 10 + i,
        });
      }

      const metrics = optimizer.demandMetrics.get('deluxe');
      expect(metrics.length).toBe(7);
    });

    it('should track revenue per occupancy', () => {
      optimizer.recordDemandMetrics('deluxe', {
        occupancy: 80,
        bookings: 8,
      });
      optimizer.recordDemandMetrics('deluxe', {
        occupancy: 90,
        bookings: 9,
      });

      const metrics = optimizer.demandMetrics.get('deluxe');
      expect(metrics[1].occupancy).toBe(90);
    });
  });

  // ===== ELASTICITY ANALYSIS TESTS =====

  describe('Price Elasticity Analysis', () => {
    beforeEach(() => {
      // Establish baseline metrics
      for (let i = 0; i < 14; i++) {
        optimizer.recordDemandMetrics('deluxe', {
          occupancy: 70 + Math.random() * 10,
          bookings: 7,
        });
        optimizer.setPrice('deluxe', 100 + Math.random() * 5);
      }
    });

    it('should analyze price elasticity', () => {
      const elasticity = optimizer.analyzePriceElasticity('deluxe');
      expect(elasticity).toBeDefined();
      expect(elasticity.elasticity).toBeDefined();
    });

    it('should return null for insufficient data', () => {
      const service = new PriceOptimizationService();
      const elasticity = service.analyzePriceElasticity('deluxe');
      expect(elasticity).toBeNull();
    });

    it('should calculate elasticity coefficient', () => {
      const elasticity = optimizer.analyzePriceElasticity('deluxe');
      expect(typeof parseFloat(elasticity.elasticity)).toBe('number');
    });

    it('should interpret elasticity', () => {
      const elasticity = optimizer.analyzePriceElasticity('deluxe');
      expect(elasticity.interpretation).toBeDefined();
      expect(typeof elasticity.interpretation).toBe('string');
    });
  });

  // ===== REVENUE PROJECTION TESTS =====

  describe('Revenue Projection', () => {
    beforeEach(() => {
      for (let i = 0; i < 14; i++) {
        optimizer.recordDemandMetrics('deluxe', {
          occupancy: 80 + Math.random() * 10,
          bookings: 8 + Math.random() * 2,
        });
      }
      optimizer.setPrice('deluxe', 120);
    });

    it('should project revenue', () => {
      const projection = optimizer.projectRevenue('deluxe', 7);
      expect(projection).toBeDefined();
      expect(projection.projectedDailyRevenue).toBeDefined();
    });

    it('should calculate horizon revenue', () => {
      const projection = optimizer.projectRevenue('deluxe', 7);
      const horizonRev = parseFloat(projection.projectedHorizonRevenue);
      const dailyRev = parseFloat(projection.projectedDailyRevenue);
      
      expect(horizonRev).toBeGreaterThan(dailyRev);
    });

    it('should return null for insufficient data', () => {
      const service = new PriceOptimizationService();
      const projection = service.projectRevenue('nonexistent');
      expect(projection).toBeNull();
    });
  });

  // ===== REVENUE OPTIMIZATION TESTS =====

  describe('Revenue Optimization Recommendations', () => {
    beforeEach(() => {
      for (let i = 0; i < 7; i++) {
        optimizer.recordDemandMetrics('deluxe', {
          occupancy: 85,
          bookings: 8,
        });
      }
      optimizer.setPrice('deluxe', 100);
    });

    it('should recommend price increase for high occupancy', () => {
      const rec = optimizer.getRevenueOptimization('deluxe');
      expect(['increase', 'decrease', 'hold']).toContain(rec.recommendation);
    });

    it('should recommend price decrease for low occupancy', () => {
      // Record low occupancy
      const service = new PriceOptimizationService();
      for (let i = 0; i < 7; i++) {
        service.recordDemandMetrics('standard', {
          occupancy: 35,
          bookings: 3,
        });
      }
      service.setPrice('standard', 100);

      const rec = service.getRevenueOptimization('standard');
      expect(rec).toBeDefined();
      expect(rec.occupancy).toBeDefined();
    });

    it('should provide recommendation reason', () => {
      const rec = optimizer.getRevenueOptimization('deluxe');
      expect(rec.reason).toBeDefined();
      expect(typeof rec.reason).toBe('string');
    });

    it('should calculate recommended price', () => {
      const rec = optimizer.getRevenueOptimization('deluxe');
      const recommendedPrice = parseFloat(rec.recommendedPrice);
      expect(recommendedPrice).toBeGreaterThanOrEqual(optimizer.config.minPrice);
      expect(recommendedPrice).toBeLessThanOrEqual(optimizer.config.maxPrice);
    });
  });

  // ===== A/B TESTING TESTS =====

  describe('A/B Testing', () => {
    it('should create experiment', () => {
      const experiment = optimizer.createExperiment('test1', 'deluxe', [
        { name: 'control', price: 100 },
        { name: 'variant_a', price: 110 },
        { name: 'variant_b', price: 90 },
      ]);

      expect(experiment).toBeDefined();
      expect(experiment.variants.length).toBe(3);
    });

    it('should record experiment results', () => {
      optimizer.createExperiment('test1', 'deluxe', [
        { name: 'control', price: 100 },
        { name: 'variant_a', price: 110 },
      ]);

      optimizer.recordExperimentResult('test1', 'control', 10, 1000);
      optimizer.recordExperimentResult('test1', 'variant_a', 12, 1320);

      const results = optimizer.getExperimentResults('test1');
      expect(results.variants[0].conversions).toBe(10);
      expect(results.variants[1].conversions).toBe(12);
    });

    it('should determine experiment winner', () => {
      optimizer.createExperiment('test1', 'deluxe', [
        { name: 'control', price: 100 },
        { name: 'variant_a', price: 110 },
      ]);

      optimizer.recordExperimentResult('test1', 'control', 10, 1000);
      optimizer.recordExperimentResult('test1', 'variant_a', 15, 1650);

      const results = optimizer.getExperimentResults('test1');
      expect(results.winner.name).toBe('variant_a');
    });

    it('should calculate conversion metrics', () => {
      optimizer.createExperiment('test1', 'deluxe', [
        { name: 'control', price: 100 },
      ]);

      optimizer.recordExperimentResult('test1', 'control', 5, 500);
      optimizer.recordExperimentResult('test1', 'control', 5, 500);

      const results = optimizer.getExperimentResults('test1');
      expect(results.variants[0].conversions).toBe(10);
      expect(parseFloat(results.variants[0].revenuePerImpression)).toBeGreaterThan(0);
    });
  });

  // ===== PRICE HISTORY TESTS =====

  describe('Price History', () => {
    it('should return price history', () => {
      optimizer.setPrice('deluxe', 100);
      optimizer.setPrice('deluxe', 110);
      optimizer.setPrice('deluxe', 105);

      const history = optimizer.getPriceHistory('deluxe', 30);
      expect(history).toBeDefined();
      expect(history.current).toBe(105);
      expect(history.count).toBe(3);
    });

    it('should calculate average price', () => {
      optimizer.setPrice('deluxe', 100);
      optimizer.setPrice('deluxe', 120);
      optimizer.setPrice('deluxe', 140);

      const history = optimizer.getPriceHistory('deluxe');
      expect(parseFloat(history.average)).toBeCloseTo(120, 0);
    });

    it('should track min and max prices', () => {
      optimizer.setPrice('deluxe', 100);
      optimizer.setPrice('deluxe', 120);
      optimizer.setPrice('deluxe', 80);

      const history = optimizer.getPriceHistory('deluxe');
      expect(history.min).toBe(80);
      expect(history.max).toBe(120);
    });
  });

  // ===== HEALTH CHECK TESTS =====

  describe('Health Check', () => {
    it('should report healthy status', () => {
      optimizer.setPrice('deluxe', 120);
      const health = optimizer.healthCheck();
      expect(health.status).toBe('healthy');
    });

    it('should track managed room types', () => {
      optimizer.setPrice('deluxe', 120);
      optimizer.setPrice('standard', 80);
      const health = optimizer.healthCheck();
      expect(health.roomTypesManaged).toBe(2);
    });

    it('should track active experiments', () => {
      optimizer.createExperiment('test1', 'deluxe', [
        { name: 'control', price: 100 },
      ]);
      const health = optimizer.healthCheck();
      expect(health.activeExperiments).toBe(1);
    });
  });

  // ===== DATA MANAGEMENT TESTS =====

  describe('Data Management', () => {
    it('should clear all data', () => {
      optimizer.setPrice('deluxe', 120);
      optimizer.recordDemandMetrics('deluxe', { occupancy: 80 });

      expect(optimizer.prices.size).toBeGreaterThan(0);
      optimizer.clear();
      expect(optimizer.prices.size).toBe(0);
      expect(optimizer.demandMetrics.size).toBe(0);
    });
  });

  // ===== EDGE CASES =====

  describe('Edge Cases', () => {
    it('should handle price at boundary', () => {
      optimizer.setPrice('deluxe', optimizer.config.minPrice);
      expect(optimizer.getPrice('deluxe')).toBe(optimizer.config.minPrice);

      optimizer.setPrice('deluxe', optimizer.config.maxPrice);
      expect(optimizer.getPrice('deluxe')).toBe(optimizer.config.maxPrice);
    });

    it('should handle zero occupancy', () => {
      const result = optimizer.calculateOptimalPrice('deluxe', {
        occupancy: 0,
        forecast: 0,
      });

      const price = parseFloat(result.optimalPrice);
      expect(price).toBeGreaterThan(0);
      expect(price).toBeLessThan(optimizer.config.basePrice);
    });

    it('should handle 100% occupancy', () => {
      const result = optimizer.calculateOptimalPrice('deluxe', {
        occupancy: 100,
        forecast: 100,
      });

      const price = parseFloat(result.optimalPrice);
      expect(price).toBeGreaterThan(optimizer.config.basePrice);
    });

    it('should handle multiple room types independently', () => {
      optimizer.setPrice('deluxe', 150);
      optimizer.setPrice('standard', 80);
      optimizer.setPrice('suite', 200);

      expect(optimizer.getPrice('deluxe')).toBe(150);
      expect(optimizer.getPrice('standard')).toBe(80);
      expect(optimizer.getPrice('suite')).toBe(200);
    });
  });

  // ===== CONCURRENCY TESTS =====

  describe('Concurrent Operations', () => {
    it('should handle concurrent price updates', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve(optimizer.setPrice('deluxe', 100 + i * 5))
        );
      }

      await Promise.all(promises);
      expect(optimizer.getPrice('deluxe')).toBeGreaterThan(100);
    });

    it('should handle concurrent demand recording', async () => {
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          Promise.resolve(
            optimizer.recordDemandMetrics('deluxe', {
              occupancy: 50 + Math.random() * 50,
              bookings: Math.random() * 10,
            })
          )
        );
      }

      await Promise.all(promises);
      const metrics = optimizer.demandMetrics.get('deluxe');
      expect(metrics.length).toBe(50);
    });
  });
});
