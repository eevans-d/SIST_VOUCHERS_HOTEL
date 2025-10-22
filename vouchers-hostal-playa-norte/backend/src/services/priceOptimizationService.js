/**
 * Price Optimization Service
 * Dynamic pricing based on demand, seasonality, competition
 * Issues: #27 → #28 (Demand Forecasting → Price Optimization)
 * 
 * Pattern: Revenue management algorithm
 * Features:
 *  - Demand-based pricing
 *  - Seasonal adjustments
 *  - Competition monitoring
 *  - Revenue optimization
 *  - Price elasticity analysis
 *  - A/B testing support
 */

export default class PriceOptimizationService {
  constructor(config = {}) {
    this.config = {
      basePrice: config.basePrice || 100,
      minPrice: config.minPrice || 50,
      maxPrice: config.maxPrice || 300,
      demandFactor: config.demandFactor || 0.5, // 0-1
      seasonalFactor: config.seasonalFactor || 0.3,
      competitionFactor: config.competitionFactor || 0.2,
      elasticity: config.elasticity || -0.7, // Price elasticity of demand
      updateFrequency: config.updateFrequency || 3600000, // 1 hour
      ...config,
    };

    // Pricing data
    this.prices = new Map(); // roomType -> { current, history, changes }
    this.demandMetrics = new Map(); // roomType -> demand metrics
    this.competitorPrices = new Map(); // competitor -> { roomType -> price }
    this.historicalPrices = []; // Audit trail
    this.priceExperiments = new Map(); // A/B testing
  }

  /**
   * Calculate price based on factors
   * Price = Base * Demand_Multiplier * Seasonal_Multiplier * Competition_Multiplier
   */
  calculateOptimalPrice(roomType, demandData = {}, seasonalIndex = 1.0, competitionAvg = null) {
    const demandMultiplier = this._calculateDemandMultiplier(
      demandData.occupancy || 50,
      demandData.forecast || 50
    );

    const competitionMultiplier = this._calculateCompetitionMultiplier(
      this.config.basePrice,
      competitionAvg
    );

    let optimalPrice =
      this.config.basePrice *
      (1 + this.config.demandFactor * (demandMultiplier - 1)) *
      (1 + this.config.seasonalFactor * (seasonalIndex - 1)) *
      (1 + this.config.competitionFactor * (competitionMultiplier - 1));

    // Apply bounds
    optimalPrice = Math.max(
      this.config.minPrice,
      Math.min(this.config.maxPrice, optimalPrice)
    );

    return {
      roomType,
      optimalPrice: optimalPrice.toFixed(2),
      components: {
        basePrice: this.config.basePrice,
        demandMultiplier: demandMultiplier.toFixed(3),
        seasonalMultiplier: seasonalIndex.toFixed(3),
        competitionMultiplier: competitionMultiplier.toFixed(3),
      },
      occupancy: demandData.occupancy,
      forecast: demandData.forecast,
      seasonalIndex: seasonalIndex.toFixed(3),
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate demand multiplier
   * Higher occupancy/forecast = higher multiplier
   * @private
   */
  _calculateDemandMultiplier(occupancy, forecast) {
    const avgDemand = (occupancy + forecast) / 2;
    
    // Sigmoid function: scales 0-100 to 0.5-1.5
    const normalized = avgDemand / 100;
    const multiplier = 0.5 + (1.5 - 0.5) / (1 + Math.exp(-10 * (normalized - 0.5)));

    return multiplier;
  }

  /**
   * Calculate competition multiplier
   * @private
   */
  _calculateCompetitionMultiplier(ourPrice, competitorAvg) {
    if (!competitorAvg) {
      return 1.0;
    }

    const priceRatio = ourPrice / competitorAvg;
    
    // If competitors are cheaper, lower multiplier
    // If competitors are expensive, higher multiplier
    return Math.min(1.3, Math.max(0.7, priceRatio));
  }

  /**
   * Set current price for room type
   */
  setPrice(roomType, price, reason = '') {
    if (!this.prices.has(roomType)) {
      this.prices.set(roomType, {
        current: this.config.basePrice,
        history: [],
        changes: [],
        lastUpdated: Date.now(),
      });
    }

    const roomPricing = this.prices.get(roomType);
    const oldPrice = roomPricing.current;
    const priceChange = price - oldPrice;
    const changePercent = (priceChange / oldPrice) * 100;

    roomPricing.current = price;
    roomPricing.lastUpdated = Date.now();

    const change = {
      timestamp: Date.now(),
      oldPrice,
      newPrice: price,
      changeAmount: priceChange,
      changePercent: changePercent.toFixed(2),
      reason,
    };

    roomPricing.history.push(price);
    roomPricing.changes.push(change);
    this.historicalPrices.push({ roomType, ...change });

    // Keep last 1000 prices per room
    if (roomPricing.history.length > 1000) {
      roomPricing.history.shift();
    }

    // Keep last 500 changes total
    if (this.historicalPrices.length > 500) {
      this.historicalPrices.shift();
    }

    return change;
  }

  /**
   * Get current price
   */
  getPrice(roomType) {
    if (!this.prices.has(roomType)) {
      return this.config.basePrice;
    }

    return this.prices.get(roomType).current;
  }

  /**
   * Update competitor prices
   */
  updateCompetitorPrice(competitorName, roomType, price) {
    if (!this.competitorPrices.has(competitorName)) {
      this.competitorPrices.set(competitorName, {});
    }

    const competitorData = this.competitorPrices.get(competitorName);
    competitorData[roomType] = {
      price,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get average competitor price
   */
  getAverageCompetitorPrice(roomType) {
    const prices = [];

    for (const competitorData of this.competitorPrices.values()) {
      if (competitorData[roomType]) {
        prices.push(competitorData[roomType].price);
      }
    }

    if (prices.length === 0) {
      return null;
    }

    return prices.reduce((a, b) => a + b, 0) / prices.length;
  }

  /**
   * Record demand metrics
   */
  recordDemandMetrics(roomType, metrics) {
    if (!this.demandMetrics.has(roomType)) {
      this.demandMetrics.set(roomType, []);
    }

    const data = this.demandMetrics.get(roomType);
    data.push({
      timestamp: Date.now(),
      occupancy: metrics.occupancy || 0,
      forecast: metrics.forecast || 0,
      bookings: metrics.bookings || 0,
      inquiries: metrics.inquiries || 0,
      cancellations: metrics.cancellations || 0,
    });

    // Keep last 365 days of metrics
    if (data.length > 365) {
      data.shift();
    }
  }

  /**
   * Analyze price elasticity
   * How much demand changes with price changes
   */
  analyzePriceElasticity(roomType) {
    const metrics = this.demandMetrics.get(roomType);
    const priceHistory = this.prices.get(roomType)?.history || [];

    if (!metrics || metrics.length < 10 || priceHistory.length < 10) {
      return null;
    }

    // Compare recent metrics with historical
    const recentOccupancy = metrics.slice(-7).reduce((a, b) => a + b.occupancy, 0) / 7;
    const previousOccupancy = metrics.slice(-14, -7).reduce((a, b) => a + b.occupancy, 0) / 7;

    const recentPrice = priceHistory.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const previousPrice = priceHistory.slice(-14, -7).reduce((a, b) => a + b, 0) / 7;

    const demandChange = (recentOccupancy - previousOccupancy) / previousOccupancy;
    const priceChange = (recentPrice - previousPrice) / previousPrice;

    const elasticity = priceChange !== 0 ? demandChange / priceChange : 0;

    return {
      roomType,
      elasticity: elasticity.toFixed(3),
      recentOccupancy: recentOccupancy.toFixed(2),
      previousOccupancy: previousOccupancy.toFixed(2),
      recentPrice: recentPrice.toFixed(2),
      previousPrice: previousPrice.toFixed(2),
      interpretation: this._interpretElasticity(elasticity),
    };
  }

  /**
   * Interpret elasticity value
   * @private
   */
  _interpretElasticity(elasticity) {
    if (elasticity < -1.5) return 'Highly elastic (small price increase reduces demand significantly)';
    if (elasticity < -0.5) return 'Elastic (price changes affect demand noticeably)';
    if (elasticity < 0.5) return 'Inelastic (demand not very sensitive to price)';
    return 'Anomalous elasticity (check data)';
  }

  /**
   * Revenue projection
   */
  projectRevenue(roomType, horizon = 7) {
    const metrics = this.demandMetrics.get(roomType);
    const currentPrice = this.getPrice(roomType);

    if (!metrics || metrics.length === 0) {
      return null;
    }

    const recentMetrics = metrics.slice(-horizon);
    const avgOccupancy = recentMetrics.reduce((a, b) => a + b.occupancy, 0) / horizon;
    const avgBookings = recentMetrics.reduce((a, b) => a + b.bookings, 0) / horizon;

    const projectedDailyRevenue = avgBookings * currentPrice;
    const projectedHorizonRevenue = projectedDailyRevenue * horizon;

    // Rooms reserved = bookings per day
    const rooms = avgBookings; // Assuming 1 booking = 1 room

    return {
      roomType,
      currentPrice: currentPrice.toFixed(2),
      averageOccupancy: avgOccupancy.toFixed(2),
      averageBookings: avgBookings.toFixed(2),
      projectedDailyRevenue: projectedDailyRevenue.toFixed(2),
      projectedHorizonRevenue: projectedHorizonRevenue.toFixed(2),
      horizon,
    };
  }

  /**
   * Revenue optimization recommendation
   */
  getRevenueOptimization(roomType) {
    const metrics = this.demandMetrics.get(roomType);
    const currentPrice = this.getPrice(roomType);

    if (!metrics || metrics.length < 7) {
      return null;
    }

    const recentOccupancy = metrics.slice(-7).reduce((a, b) => a + b.occupancy, 0) / 7;
    const elasticity = this.analyzePriceElasticity(roomType)?.elasticity || this.config.elasticity;

    let recommendation = 'hold';
    let priceAdjustment = 0;

    if (recentOccupancy > 85) {
      // High occupancy - can increase price
      recommendation = 'increase';
      priceAdjustment = 10;
    } else if (recentOccupancy > 70) {
      // Good occupancy - minor increase
      recommendation = 'increase';
      priceAdjustment = 5;
    } else if (recentOccupancy < 40) {
      // Low occupancy - decrease price
      recommendation = 'decrease';
      priceAdjustment = -15;
    } else if (recentOccupancy < 55) {
      // Moderate occupancy - slight decrease
      recommendation = 'decrease';
      priceAdjustment = -7;
    }

    // Adjust for elasticity
    if (elasticity < -1.0) {
      priceAdjustment *= 0.8; // More conservative for elastic demand
    }

    const recommendedPrice = Math.max(
      this.config.minPrice,
      Math.min(
        this.config.maxPrice,
        currentPrice * (1 + priceAdjustment / 100)
      )
    );

    return {
      roomType,
      currentPrice: currentPrice.toFixed(2),
      recommendedPrice: recommendedPrice.toFixed(2),
      priceAdjustment: priceAdjustment.toFixed(2),
      recommendation,
      reason: this._getPriceRecommendationReason(recentOccupancy, elasticity),
      occupancy: recentOccupancy.toFixed(2),
    };
  }

  /**
   * Get recommendation reason
   * @private
   */
  _getPriceRecommendationReason(occupancy, elasticity) {
    if (occupancy > 85) {
      return 'High occupancy indicates strong demand - increase price to maximize revenue';
    }
    if (occupancy > 70) {
      return 'Good occupancy - minor price increase maintains profitability';
    }
    if (occupancy < 40) {
      return 'Low occupancy - significant price decrease needed to stimulate demand';
    }
    return 'Moderate occupancy - adjust price to optimize revenue balance';
  }

  /**
   * Create A/B test
   */
  createExperiment(testId, roomType, variants) {
    // variants = [{ name: 'control', price: 100 }, { name: 'variant_a', price: 110 }]

    this.priceExperiments.set(testId, {
      testId,
      roomType,
      variants: variants.map(v => ({
        ...v,
        conversions: 0,
        revenue: 0,
        impressions: 0,
      })),
      startedAt: Date.now(),
      status: 'active',
    });

    return this.priceExperiments.get(testId);
  }

  /**
   * Record experiment result
   */
  recordExperimentResult(testId, variantName, bookings, revenue) {
    const experiment = this.priceExperiments.get(testId);
    if (!experiment) return null;

    const variant = experiment.variants.find(v => v.name === variantName);
    if (!variant) return null;

    variant.conversions += bookings;
    variant.revenue += revenue;
    variant.impressions += 1;
    variant.conversionRate = (variant.conversions / variant.impressions * 100).toFixed(2);
    variant.revenuePerImpression = (variant.revenue / variant.impressions).toFixed(2);

    return variant;
  }

  /**
   * Get experiment results
   */
  getExperimentResults(testId) {
    const experiment = this.priceExperiments.get(testId);
    if (!experiment) return null;

    const results = experiment.variants.map(v => ({
      name: v.name,
      price: v.price,
      conversions: v.conversions,
      conversionRate: v.conversionRate || '0.00',
      revenue: v.revenue.toFixed(2),
      revenuePerImpression: v.revenuePerImpression || '0.00',
      impressions: v.impressions,
    }));

    // Calculate best performer
    const bestVariant = results.reduce((best, current) =>
      parseFloat(current.revenuePerImpression) > parseFloat(best.revenuePerImpression)
        ? current
        : best
    );

    return {
      testId,
      roomType: experiment.roomType,
      startedAt: new Date(experiment.startedAt).toISOString(),
      duration: Date.now() - experiment.startedAt,
      status: experiment.status,
      variants: results,
      winner: bestVariant,
    };
  }

  /**
   * Get price history
   */
  getPriceHistory(roomType, days = 30) {
    const roomPricing = this.prices.get(roomType);
    if (!roomPricing) return null;

    const recent = roomPricing.history.slice(-days);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const sorted = [...recent].sort((a, b) => a - b);

    return {
      roomType,
      current: roomPricing.current,
      average: avg.toFixed(2),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      count: recent.length,
      changes: roomPricing.changes.slice(-10),
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: 'healthy',
      roomTypesManaged: this.prices.size,
      competitorsTracked: this.competitorPrices.size,
      demandMetricsRecorded: this.demandMetrics.size,
      totalPriceChanges: this.historicalPrices.length,
      activeExperiments: Array.from(this.priceExperiments.values())
        .filter(e => e.status === 'active').length,
      config: {
        basePrice: this.config.basePrice,
        minPrice: this.config.minPrice,
        maxPrice: this.config.maxPrice,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Clear data
   */
  clear() {
    this.prices.clear();
    this.demandMetrics.clear();
    this.competitorPrices.clear();
    this.historicalPrices = [];
    this.priceExperiments.clear();
  }
}
