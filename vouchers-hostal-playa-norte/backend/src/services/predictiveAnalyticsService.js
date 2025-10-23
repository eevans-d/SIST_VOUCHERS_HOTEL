// backend/src/services/predictiveAnalyticsService.js

/**
 * Advanced Predictive Analytics Service
 * Churn prediction, enhanced revenue forecasting, customer lifetime value, market basket analysis
 */

class PredictiveAnalyticsService {
  constructor(config = {}) {
    this.config = {
      modelUpdateInterval: config.modelUpdateInterval || 86400000, // 24 hours
      minDataPoints: config.minDataPoints || 100,
      confidenceThreshold: config.confidenceThreshold || 0.7,
      ...config
    };

    this.models = new Map();
    this.predictions = new Map();
    this.trainingData = new Map();
    this.modelTimer = null;
  }

  // Train churn prediction model
  async trainChurnModel(historicalData) {
    const features = this.extractChurnFeatures(historicalData);
    const labels = historicalData.map(d => d.churned ? 1 : 0);

    const model = {
      id: this.generateId(),
      type: 'churn',
      algorithm: 'logistic_regression',
      features: ['bookingFrequency', 'avgStayDuration', 'totalSpent', 'lastBookingDays', 'cancellationRate'],
      weights: this.trainLogisticRegression(features, labels),
      accuracy: 0,
      trainedAt: new Date(),
      dataPoints: historicalData.length
    };

    // Calculate accuracy
    const predictions = features.map(f => this.predictWithLogistic(f, model.weights));
    model.accuracy = this.calculateAccuracy(predictions, labels);

    this.models.set('churn', model);
    return model;
  }

  // Extract churn features
  extractChurnFeatures(data) {
    return data.map(customer => [
      customer.bookingFrequency || 0,
      customer.avgStayDuration || 0,
      customer.totalSpent || 0,
      customer.lastBookingDays || 0,
      customer.cancellationRate || 0
    ]);
  }

  // Train logistic regression
  trainLogisticRegression(X, y, learningRate = 0.01, iterations = 1000) {
    const weights = new Array(X[0].length).fill(0);
    const m = X.length;

    for (let iter = 0; iter < iterations; iter++) {
      const predictions = X.map(x => this.sigmoid(this.dotProduct(x, weights)));
      
      for (let j = 0; j < weights.length; j++) {
        let gradient = 0;
        for (let i = 0; i < m; i++) {
          gradient += (predictions[i] - y[i]) * X[i][j];
        }
        weights[j] -= (learningRate / m) * gradient;
      }
    }

    return weights;
  }

  // Sigmoid function
  sigmoid(z) {
    return 1 / (1 + Math.exp(-z));
  }

  // Dot product
  dotProduct(a, b) {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  // Predict with logistic model
  predictWithLogistic(features, weights) {
    const z = this.dotProduct(features, weights);
    return this.sigmoid(z);
  }

  // Predict customer churn
  async predictChurn(customerId, customerData) {
    const model = this.models.get('churn');
    if (!model) {
      throw new Error('Churn model not trained');
    }

    const features = [
      customerData.bookingFrequency || 0,
      customerData.avgStayDuration || 0,
      customerData.totalSpent || 0,
      customerData.lastBookingDays || 0,
      customerData.cancellationRate || 0
    ];

    const probability = this.predictWithLogistic(features, model.weights);
    const risk = probability > 0.7 ? 'high' : probability > 0.4 ? 'medium' : 'low';

    const prediction = {
      customerId,
      churnProbability: probability,
      riskLevel: risk,
      confidence: model.accuracy,
      factors: this.analyzeChurnFactors(features, model.weights),
      recommendations: this.generateChurnRecommendations(risk, features),
      predictedAt: new Date()
    };

    this.predictions.set(`churn_${customerId}`, prediction);
    return prediction;
  }

  // Analyze churn factors
  analyzeChurnFactors(features, weights) {
    const featureNames = ['bookingFrequency', 'avgStayDuration', 'totalSpent', 'lastBookingDays', 'cancellationRate'];
    const impacts = features.map((val, i) => ({
      feature: featureNames[i],
      value: val,
      weight: weights[i],
      impact: Math.abs(val * weights[i])
    }));

    return impacts.sort((a, b) => b.impact - a.impact);
  }

  // Generate churn recommendations
  generateChurnRecommendations(risk, features) {
    const recommendations = [];

    if (risk === 'high') {
      recommendations.push('Send personalized re-engagement offer');
      recommendations.push('Offer loyalty program upgrade');
      recommendations.push('Schedule follow-up call');
    }

    if (features[3] > 90) { // lastBookingDays
      recommendations.push('Send reminder email with special discount');
    }

    if (features[4] > 0.3) { // cancellationRate
      recommendations.push('Offer flexible cancellation policy');
    }

    return recommendations;
  }

  // Train revenue forecasting model
  async trainRevenueModel(historicalData) {
    const X = historicalData.map((d, i) => [i, this.getDayOfWeek(d.date), this.getMonth(d.date)]);
    const y = historicalData.map(d => d.revenue);

    const model = {
      id: this.generateId(),
      type: 'revenue',
      algorithm: 'linear_regression',
      features: ['timeIndex', 'dayOfWeek', 'month'],
      coefficients: this.trainLinearRegression(X, y),
      meanRevenue: this.mean(y),
      stdRevenue: this.std(y),
      trainedAt: new Date(),
      dataPoints: historicalData.length
    };

    this.models.set('revenue', model);
    return model;
  }

  // Train linear regression
  trainLinearRegression(X, y) {
    const n = X.length;
    const features = X[0].length;
    const coefficients = new Array(features + 1).fill(0);

    // Simple gradient descent
    const learningRate = 0.0001;
    const iterations = 1000;

    for (let iter = 0; iter < iterations; iter++) {
      const predictions = X.map(x => {
        let pred = coefficients[0];
        for (let j = 0; j < features; j++) {
          pred += coefficients[j + 1] * x[j];
        }
        return pred;
      });

      // Update intercept
      let gradient = 0;
      for (let i = 0; i < n; i++) {
        gradient += predictions[i] - y[i];
      }
      coefficients[0] -= (learningRate / n) * gradient;

      // Update coefficients
      for (let j = 0; j < features; j++) {
        gradient = 0;
        for (let i = 0; i < n; i++) {
          gradient += (predictions[i] - y[i]) * X[i][j];
        }
        coefficients[j + 1] -= (learningRate / n) * gradient;
      }
    }

    return coefficients;
  }

  // Forecast revenue
  async forecastRevenue(daysAhead = 30, options = {}) {
    const model = this.models.get('revenue');
    if (!model) {
      throw new Error('Revenue model not trained');
    }

    const forecasts = [];
    const today = new Date();

    for (let i = 1; i <= daysAhead; i++) {
      const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      const features = [model.dataPoints + i, this.getDayOfWeek(date), this.getMonth(date)];
      
      let revenue = model.coefficients[0];
      for (let j = 0; j < features.length; j++) {
        revenue += model.coefficients[j + 1] * features[j];
      }

      forecasts.push({
        date,
        revenue: Math.max(0, revenue),
        confidence: this.calculateForecastConfidence(i, model),
        upperBound: revenue * 1.2,
        lowerBound: revenue * 0.8
      });
    }

    return {
      forecasts,
      totalRevenue: forecasts.reduce((sum, f) => sum + f.revenue, 0),
      avgDailyRevenue: forecasts.reduce((sum, f) => sum + f.revenue, 0) / daysAhead,
      model: model.type,
      generatedAt: new Date()
    };
  }

  // Calculate forecast confidence
  calculateForecastConfidence(daysAhead, model) {
    // Confidence decreases with distance
    const baseConfidence = 0.95;
    const decayRate = 0.01;
    return Math.max(0.5, baseConfidence - (daysAhead * decayRate));
  }

  // Calculate Customer Lifetime Value
  async calculateCLV(customerId, customerData) {
    const avgPurchaseValue = customerData.totalSpent / customerData.bookingCount;
    const purchaseFrequency = customerData.bookingCount / customerData.customerAgeDays * 365;
    const avgCustomerValue = avgPurchaseValue * purchaseFrequency;
    const avgCustomerLifespan = 5; // years (industry average)

    const clv = avgCustomerValue * avgCustomerLifespan;

    // Adjust for churn risk
    let churnPrediction = null;
    if (this.models.has('churn')) {
      churnPrediction = await this.predictChurn(customerId, customerData);
      const churnAdjustment = 1 - (churnPrediction.churnProbability * 0.5);
      return {
        customerId,
        clv: clv * churnAdjustment,
        unadjustedCLV: clv,
        avgPurchaseValue,
        purchaseFrequency,
        avgCustomerValue,
        avgCustomerLifespan,
        churnAdjustment,
        churnRisk: churnPrediction.riskLevel,
        segment: this.segmentByValue(clv),
        calculatedAt: new Date()
      };
    }

    return {
      customerId,
      clv,
      avgPurchaseValue,
      purchaseFrequency,
      avgCustomerValue,
      avgCustomerLifespan,
      segment: this.segmentByValue(clv),
      calculatedAt: new Date()
    };
  }

  // Segment customer by value
  segmentByValue(clv) {
    if (clv > 10000) return 'platinum';
    if (clv > 5000) return 'gold';
    if (clv > 2000) return 'silver';
    return 'bronze';
  }

  // Market basket analysis
  async analyzeMarketBasket(transactions) {
    const itemSets = this.extractItemSets(transactions);
    const support = this.calculateSupport(itemSets, transactions.length);
    const rules = this.generateAssociationRules(support, 0.01, 0.5);

    return {
      totalTransactions: transactions.length,
      uniqueItems: new Set(transactions.flat()).size,
      frequentItemSets: support,
      associationRules: rules,
      topRecommendations: this.getTopRecommendations(rules, 10),
      analyzedAt: new Date()
    };
  }

  // Extract item sets
  extractItemSets(transactions) {
    const itemSets = new Map();

    transactions.forEach(transaction => {
      // Single items
      transaction.forEach(item => {
        const key = JSON.stringify([item]);
        itemSets.set(key, (itemSets.get(key) || 0) + 1);
      });

      // Pairs
      for (let i = 0; i < transaction.length; i++) {
        for (let j = i + 1; j < transaction.length; j++) {
          const key = JSON.stringify([transaction[i], transaction[j]].sort());
          itemSets.set(key, (itemSets.get(key) || 0) + 1);
        }
      }

      // Triplets
      for (let i = 0; i < transaction.length; i++) {
        for (let j = i + 1; j < transaction.length; j++) {
          for (let k = j + 1; k < transaction.length; k++) {
            const key = JSON.stringify([transaction[i], transaction[j], transaction[k]].sort());
            itemSets.set(key, (itemSets.get(key) || 0) + 1);
          }
        }
      }
    });

    return itemSets;
  }

  // Calculate support
  calculateSupport(itemSets, totalTransactions) {
    const support = [];

    itemSets.forEach((count, itemSet) => {
      support.push({
        items: JSON.parse(itemSet),
        count,
        support: count / totalTransactions
      });
    });

    return support.filter(s => s.support >= 0.01).sort((a, b) => b.support - a.support);
  }

  // Generate association rules
  generateAssociationRules(support, minSupport, minConfidence) {
    const rules = [];

    support.forEach(itemSet => {
      if (itemSet.items.length < 2) return;

      // Generate all possible rules
      for (let i = 0; i < itemSet.items.length; i++) {
        const antecedent = [itemSet.items[i]];
        const consequent = itemSet.items.filter((_, j) => j !== i);

        const antecedentSupport = support.find(s => 
          s.items.length === 1 && s.items[0] === antecedent[0]
        );

        if (antecedentSupport) {
          const confidence = itemSet.support / antecedentSupport.support;
          const lift = confidence / (itemSet.support);

          if (confidence >= minConfidence) {
            rules.push({
              antecedent,
              consequent,
              support: itemSet.support,
              confidence,
              lift
            });
          }
        }
      }
    });

    return rules.sort((a, b) => b.confidence - a.confidence);
  }

  // Get top recommendations
  getTopRecommendations(rules, limit = 10) {
    return rules.slice(0, limit).map(rule => ({
      if: rule.antecedent,
      then: rule.consequent,
      confidence: (rule.confidence * 100).toFixed(1) + '%',
      lift: rule.lift.toFixed(2)
    }));
  }

  // Demand forecasting
  async forecastDemand(roomType, daysAhead = 30) {
    // Simulated demand forecast
    const forecasts = [];
    const today = new Date();

    for (let i = 1; i <= daysAhead; i++) {
      const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      const dayOfWeek = this.getDayOfWeek(date);
      const month = this.getMonth(date);

      // Simple heuristic-based forecast
      let demand = 50; // base demand
      
      // Weekend boost
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        demand += 20;
      }

      // Seasonal adjustment
      if (month >= 6 && month <= 8) {
        demand += 30; // Summer peak
      }

      forecasts.push({
        date,
        roomType,
        demand: Math.round(demand),
        confidence: this.calculateForecastConfidence(i, { type: 'demand' })
      });
    }

    return {
      roomType,
      forecasts,
      avgDailyDemand: forecasts.reduce((sum, f) => sum + f.demand, 0) / daysAhead,
      peakDemandDate: forecasts.reduce((max, f) => f.demand > max.demand ? f : max),
      generatedAt: new Date()
    };
  }

  // Price optimization
  async optimizePrice(roomType, date, constraints = {}) {
    const demand = await this.forecastDemand(roomType, 1);
    const currentDemand = demand.forecasts[0].demand;

    const basePrice = constraints.basePrice || 100;
    const maxPrice = constraints.maxPrice || 500;
    const minPrice = constraints.minPrice || 50;

    // Dynamic pricing based on demand
    let optimalPrice = basePrice;

    if (currentDemand > 80) {
      optimalPrice = basePrice * 1.5; // High demand
    } else if (currentDemand > 60) {
      optimalPrice = basePrice * 1.2; // Moderate demand
    } else if (currentDemand < 30) {
      optimalPrice = basePrice * 0.8; // Low demand
    }

    optimalPrice = Math.max(minPrice, Math.min(maxPrice, optimalPrice));

    return {
      roomType,
      date,
      optimalPrice: Math.round(optimalPrice),
      basePrice,
      priceChange: ((optimalPrice - basePrice) / basePrice * 100).toFixed(1) + '%',
      demand: currentDemand,
      strategy: currentDemand > 70 ? 'maximize_revenue' : 'maximize_occupancy',
      calculatedAt: new Date()
    };
  }

  // Sentiment analysis
  analyzeSentiment(reviews) {
    const positive = ['excellent', 'great', 'amazing', 'wonderful', 'perfect', 'love', 'best'];
    const negative = ['bad', 'poor', 'terrible', 'worst', 'hate', 'awful', 'disappointing'];

    const scores = reviews.map(review => {
      const text = review.text.toLowerCase();
      let score = 0;

      positive.forEach(word => {
        score += (text.match(new RegExp(word, 'g')) || []).length;
      });

      negative.forEach(word => {
        score -= (text.match(new RegExp(word, 'g')) || []).length;
      });

      return {
        reviewId: review.id,
        text: review.text,
        score,
        sentiment: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral'
      };
    });

    const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    const positiveCount = scores.filter(s => s.sentiment === 'positive').length;
    const negativeCount = scores.filter(s => s.sentiment === 'negative').length;

    return {
      totalReviews: reviews.length,
      avgScore,
      overallSentiment: avgScore > 0 ? 'positive' : avgScore < 0 ? 'negative' : 'neutral',
      positivePercentage: (positiveCount / reviews.length * 100).toFixed(1) + '%',
      negativePercentage: (negativeCount / reviews.length * 100).toFixed(1) + '%',
      scores,
      analyzedAt: new Date()
    };
  }

  // Utility functions
  getDayOfWeek(date) {
    return new Date(date).getDay();
  }

  getMonth(date) {
    return new Date(date).getMonth();
  }

  mean(arr) {
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }

  std(arr) {
    const avg = this.mean(arr);
    const squareDiffs = arr.map(val => Math.pow(val - avg, 2));
    return Math.sqrt(this.mean(squareDiffs));
  }

  calculateAccuracy(predictions, labels) {
    let correct = 0;
    for (let i = 0; i < predictions.length; i++) {
      if ((predictions[i] > 0.5 ? 1 : 0) === labels[i]) {
        correct++;
      }
    }
    return correct / predictions.length;
  }

  generateId() {
    return `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get model info
  getModel(type) {
    return this.models.get(type);
  }

  // List all models
  listModels() {
    return Array.from(this.models.values());
  }

  // Get prediction
  getPrediction(key) {
    return this.predictions.get(key);
  }

  // Get statistics
  getStatistics() {
    return {
      modelsLoaded: this.models.size,
      predictionsCached: this.predictions.size,
      confidenceThreshold: this.config.confidenceThreshold
    };
  }
}

export default PredictiveAnalyticsService;
