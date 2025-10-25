import PredictiveAnalyticsService from '../../src/services/predictiveAnalyticsService.js';

describe('PredictiveAnalyticsService', () => {
  let service;

  beforeEach(() => {
    service = new PredictiveAnalyticsService();
  });

  describe('Churn Prediction', () => {
    it('should train churn model', async () => {
      const trainingData = [
        { bookingFrequency: 5, avgStayDuration: 3, totalSpent: 1000, lastBookingDays: 30, cancellationRate: 0.1, churned: false },
        { bookingFrequency: 1, avgStayDuration: 2, totalSpent: 200, lastBookingDays: 180, cancellationRate: 0.5, churned: true }
      ];

      const model = await service.trainChurnModel(trainingData);
      expect(model.type).toBe('churn');
      expect(model.weights.length).toBe(5);
    });

    it('should predict customer churn', async () => {
      const trainingData = Array.from({ length: 100 }, (_, i) => ({
        bookingFrequency: Math.random() * 10,
        avgStayDuration: Math.random() * 5,
        totalSpent: Math.random() * 5000,
        lastBookingDays: Math.random() * 365,
        cancellationRate: Math.random(),
        churned: Math.random() > 0.7
      }));

      await service.trainChurnModel(trainingData);

      const prediction = await service.predictChurn('customer123', {
        bookingFrequency: 2,
        avgStayDuration: 3,
        totalSpent: 500,
        lastBookingDays: 120,
        cancellationRate: 0.3
      });

      expect(prediction.churnProbability).toBeDefined();
      expect(prediction.riskLevel).toMatch(/high|medium|low/);
      expect(prediction.recommendations).toBeInstanceOf(Array);
    });

    it('should analyze churn factors', async () => {
      const trainingData = Array.from({ length: 50 }, () => ({
        bookingFrequency: 5,
        avgStayDuration: 3,
        totalSpent: 1000,
        lastBookingDays: 30,
        cancellationRate: 0.2,
        churned: false
      }));

      await service.trainChurnModel(trainingData);
      const prediction = await service.predictChurn('c1', {
        bookingFrequency: 1,
        avgStayDuration: 2,
        totalSpent: 100,
        lastBookingDays: 200,
        cancellationRate: 0.6
      });

      expect(prediction.factors[0].feature).toBeDefined();
      expect(prediction.factors[0].impact).toBeDefined();
    });
  });

  describe('Revenue Forecasting', () => {
    it('should train revenue model', async () => {
      const trainingData = Array.from({ length: 90 }, (_, i) => ({
        date: new Date(2024, 0, i + 1),
        revenue: 1000 + Math.random() * 500
      }));

      const model = await service.trainRevenueModel(trainingData);
      expect(model.type).toBe('revenue');
      expect(model.coefficients).toBeDefined();
    });

    it('should forecast revenue', async () => {
      const trainingData = Array.from({ length: 60 }, (_, i) => ({
        date: new Date(2024, 0, i + 1),
        revenue: 1000 + i * 10
      }));

      await service.trainRevenueModel(trainingData);
      const forecast = await service.forecastRevenue(30);

      expect(forecast.forecasts.length).toBe(30);
      expect(forecast.totalRevenue).toBeGreaterThan(0);
      expect(forecast.avgDailyRevenue).toBeGreaterThan(0);
    });

    it('should include confidence bounds', async () => {
      const trainingData = Array.from({ length: 30 }, (_, i) => ({
        date: new Date(2024, 0, i + 1),
        revenue: 1000
      }));

      await service.trainRevenueModel(trainingData);
      const forecast = await service.forecastRevenue(7);

      expect(forecast.forecasts[0].upperBound).toBeGreaterThan(forecast.forecasts[0].revenue);
      expect(forecast.forecasts[0].lowerBound).toBeLessThan(forecast.forecasts[0].revenue);
    });
  });

  describe('Customer Lifetime Value', () => {
    it('should calculate CLV', async () => {
      const clv = await service.calculateCLV('customer1', {
        totalSpent: 5000,
        bookingCount: 10,
        customerAgeDays: 730
      });

      expect(clv.clv).toBeGreaterThan(0);
      expect(clv.segment).toMatch(/platinum|gold|silver|bronze/);
    });

    it('should adjust for churn risk', async () => {
      const trainingData = Array.from({ length: 50 }, () => ({
        bookingFrequency: 5,
        avgStayDuration: 3,
        totalSpent: 1000,
        lastBookingDays: 30,
        cancellationRate: 0.1,
        churned: false
      }));

      await service.trainChurnModel(trainingData);

      const clv = await service.calculateCLV('customer1', {
        totalSpent: 5000,
        bookingCount: 10,
        customerAgeDays: 730,
        bookingFrequency: 10,
        avgStayDuration: 4,
        lastBookingDays: 30,
        cancellationRate: 0.1
      });

      expect(clv.churnAdjustment).toBeDefined();
      expect(clv.churnRisk).toBeDefined();
    });

    it('should segment by value', () => {
      const platinum = service.segmentByValue(15000);
      const gold = service.segmentByValue(7000);
      const silver = service.segmentByValue(3000);
      const bronze = service.segmentByValue(1000);

      expect(platinum).toBe('platinum');
      expect(gold).toBe('gold');
      expect(silver).toBe('silver');
      expect(bronze).toBe('bronze');
    });
  });

  describe('Market Basket Analysis', () => {
    it('should analyze market basket', async () => {
      const transactions = [
        ['room', 'breakfast', 'wifi'],
        ['room', 'breakfast'],
        ['room', 'wifi', 'parking'],
        ['breakfast', 'wifi']
      ];

      const analysis = await service.analyzeMarketBasket(transactions);

      expect(analysis.totalTransactions).toBe(4);
      expect(analysis.frequentItemSets).toBeInstanceOf(Array);
      expect(analysis.associationRules).toBeInstanceOf(Array);
    });

    it('should generate association rules', async () => {
      const transactions = [
        ['A', 'B', 'C'],
        ['A', 'B'],
        ['A', 'C'],
        ['B', 'C']
      ];

      const analysis = await service.analyzeMarketBasket(transactions);
      expect(analysis.topRecommendations).toBeInstanceOf(Array);
    });
  });

  describe('Demand Forecasting', () => {
    it('should forecast demand', async () => {
      const forecast = await service.forecastDemand('suite', 14);

      expect(forecast.forecasts.length).toBe(14);
      expect(forecast.avgDailyDemand).toBeGreaterThan(0);
      expect(forecast.peakDemandDate).toBeDefined();
    });

    it('should adjust for weekends', async () => {
      const forecast = await service.forecastDemand('deluxe', 7);
      
      const weekendDays = forecast.forecasts.filter(f => {
        const day = f.date.getDay();
        return day === 5 || day === 6;
      });

      weekendDays.forEach(day => {
        expect(day.demand).toBeGreaterThan(50);
      });
    });
  });

  describe('Price Optimization', () => {
    it('should optimize price', async () => {
      const optimization = await service.optimizePrice('suite', new Date(), {
        basePrice: 200,
        minPrice: 150,
        maxPrice: 400
      });

      expect(optimization.optimalPrice).toBeGreaterThanOrEqual(150);
      expect(optimization.optimalPrice).toBeLessThanOrEqual(400);
      expect(optimization.strategy).toMatch(/maximize_revenue|maximize_occupancy/);
    });

    it('should respect constraints', async () => {
      const optimization = await service.optimizePrice('deluxe', new Date(), {
        basePrice: 100,
        minPrice: 80,
        maxPrice: 120
      });

      expect(optimization.optimalPrice).toBeGreaterThanOrEqual(80);
      expect(optimization.optimalPrice).toBeLessThanOrEqual(120);
    });
  });

  describe('Sentiment Analysis', () => {
    it('should analyze sentiment', () => {
      const reviews = [
        { id: 1, text: 'Excellent service, great location, amazing staff!' },
        { id: 2, text: 'Terrible experience, poor quality, bad management.' },
        { id: 3, text: 'It was okay, nothing special.' }
      ];

      const analysis = service.analyzeSentiment(reviews);

      expect(analysis.totalReviews).toBe(3);
      expect(analysis.overallSentiment).toMatch(/positive|negative|neutral/);
      expect(analysis.scores.length).toBe(3);
    });

    it('should identify positive reviews', () => {
      const reviews = [
        { id: 1, text: 'Wonderful stay, perfect location, excellent amenities!' }
      ];

      const analysis = service.analyzeSentiment(reviews);
      expect(analysis.overallSentiment).toBe('positive');
    });

    it('should identify negative reviews', () => {
      const reviews = [
        { id: 1, text: 'Awful room, terrible service, worst hotel ever!' }
      ];

      const analysis = service.analyzeSentiment(reviews);
      expect(analysis.overallSentiment).toBe('negative');
    });
  });

  describe('Utilities', () => {
    it('should calculate sigmoid', () => {
      expect(service.sigmoid(0)).toBe(0.5);
      expect(service.sigmoid(10)).toBeGreaterThan(0.9);
      expect(service.sigmoid(-10)).toBeLessThan(0.1);
    });

    it('should calculate dot product', () => {
      const result = service.dotProduct([1, 2, 3], [4, 5, 6]);
      expect(result).toBe(32); // 1*4 + 2*5 + 3*6
    });

    it('should calculate mean', () => {
      expect(service.mean([1, 2, 3, 4, 5])).toBe(3);
    });

    it('should calculate standard deviation', () => {
      const std = service.std([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(std).toBeGreaterThan(0);
    });
  });

  describe('Model Management', () => {
    it('should get model', async () => {
      const trainingData = Array.from({ length: 20 }, () => ({
        bookingFrequency: 5,
        avgStayDuration: 3,
        totalSpent: 1000,
        lastBookingDays: 30,
        cancellationRate: 0.2,
        churned: false
      }));

      await service.trainChurnModel(trainingData);
      const model = service.getModel('churn');
      expect(model).toBeDefined();
      expect(model.type).toBe('churn');
    });

    it('should list models', async () => {
      const churnData = Array.from({ length: 20 }, () => ({
        bookingFrequency: 5,
        avgStayDuration: 3,
        totalSpent: 1000,
        lastBookingDays: 30,
        cancellationRate: 0.2,
        churned: false
      }));

      const revenueData = Array.from({ length: 30 }, (_, i) => ({
        date: new Date(2024, 0, i + 1),
        revenue: 1000
      }));

      await service.trainChurnModel(churnData);
      await service.trainRevenueModel(revenueData);

      const models = service.listModels();
      expect(models.length).toBe(2);
    });
  });

  describe('Statistics', () => {
    it('should get statistics', () => {
      const stats = service.getStatistics();
      expect(stats.modelsLoaded).toBe(0);
      expect(stats.predictionsCached).toBe(0);
    });
  });
});
