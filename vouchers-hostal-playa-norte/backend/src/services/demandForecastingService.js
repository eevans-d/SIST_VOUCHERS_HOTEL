/**
 * Demand Forecasting Service
 * Predicts occupancy, pricing, and resource needs using ML
 * Issues: #26 → #27 (Performance Profiling → Demand Forecasting)
 *
 * Pattern: Time-series analysis + ML forecasting
 * Features:
 *  - Exponential Smoothing (Holt-Winters)
 *  - Seasonal decomposition
 *  - Trend analysis
 *  - Occupancy forecasting
 *  - Resource planning
 *  - Confidence intervals
 */

export default class DemandForecastingService {
  constructor(config = {}) {
    this.config = {
      forecastHorizon: config.forecastHorizon || 30, // days ahead
      trainingDataDays: config.trainingDataDays || 365, // historical data
      alpha: config.alpha || 0.3, // level smoothing
      beta: config.beta || 0.2, // trend smoothing
      gamma: config.gamma || 0.1, // seasonal smoothing
      seasonalPeriod: config.seasonalPeriod || 7, // weekly seasonality
      confidenceLevel: config.confidenceLevel || 0.95,
      minDataPoints: config.minDataPoints || 30,
      ...config
    };

    // Data storage
    this.historicalData = new Map(); // metric_name -> { dates, values }
    this.forecasts = new Map(); // metric_name -> { dates, predictions, intervals }
    this.metrics = {
      mape: 0, // Mean Absolute Percentage Error
      rmse: 0, // Root Mean Square Error
      mae: 0 // Mean Absolute Error
    };
  }

  /**
   * Add historical data point
   * @param {string} metricName - Occupancy, revenue, demand, etc
   * @param {Date|number} date - Data timestamp
   * @param {number} value - Metric value
   */
  addDataPoint(metricName, date, value) {
    if (!this.historicalData.has(metricName)) {
      this.historicalData.set(metricName, {
        dates: [],
        values: [],
        lastUpdated: Date.now()
      });
    }

    const data = this.historicalData.get(metricName);
    const timestamp = typeof date === 'number' ? date : date.getTime();

    data.dates.push(timestamp);
    data.values.push(value);
    data.lastUpdated = Date.now();

    // Sort by date
    const indices = data.dates
      .map((d, i) => ({ date: d, index: i }))
      .sort((a, b) => a.date - b.date)
      .map((x) => x.index);

    data.dates = indices.map((i) => data.dates[i]);
    data.values = indices.map((i) => data.values[i]);

    // Keep only last N days
    const cutoffTime = Date.now() - this.config.trainingDataDays * 86400000;
    let keepIndex = 0;
    while (
      keepIndex < data.dates.length &&
      data.dates[keepIndex] < cutoffTime
    ) {
      keepIndex++;
    }

    if (keepIndex > 0) {
      data.dates = data.dates.slice(keepIndex);
      data.values = data.values.slice(keepIndex);
    }
  }

  /**
   * Batch add data points
   */
  addDataPoints(metricName, dataPoints) {
    dataPoints.forEach(({ date, value }) => {
      this.addDataPoint(metricName, date, value);
    });
  }

  /**
   * Simple Exponential Smoothing
   * @private
   */
  _simpleExponentialSmoothing(values) {
    if (values.length < 1) return [];

    const smoothed = [values[0]];
    const alpha = this.config.alpha;

    for (let i = 1; i < values.length; i++) {
      const newValue = alpha * values[i] + (1 - alpha) * smoothed[i - 1];
      smoothed.push(newValue);
    }

    return smoothed;
  }

  /**
   * Double Exponential Smoothing (Holt's method)
   * @private
   */
  _doubleExponentialSmoothing(values) {
    if (values.length < 2) return { level: values, trend: [0] };

    const alpha = this.config.alpha;
    const beta = this.config.beta;

    const level = [values[0]];
    const trend = [values[1] - values[0]];

    for (let i = 1; i < values.length; i++) {
      const newLevel =
        alpha * values[i] + (1 - alpha) * (level[i - 1] + trend[i - 1]);
      const newTrend =
        beta * (newLevel - level[i - 1]) + (1 - beta) * trend[i - 1];

      level.push(newLevel);
      trend.push(newTrend);
    }

    return { level, trend };
  }

  /**
   * Calculate seasonal indices
   * @private
   */
  _calculateSeasonalIndices(values, period = 7) {
    if (values.length < period) return Array(period).fill(1);

    const cycleLengths = Math.floor(values.length / period);
    const seasonalIndices = Array(period).fill(0);

    // Calculate average for each seasonal period
    for (let i = 0; i < period; i++) {
      let sum = 0;
      let count = 0;
      for (let j = 0; j < cycleLengths; j++) {
        sum += values[i + j * period];
        count++;
      }
      seasonalIndices[i] = count > 0 ? sum / count : 1;
    }

    // Normalize
    const avgIndex = seasonalIndices.reduce((a, b) => a + b, 0) / period;
    return seasonalIndices.map((idx) => idx / avgIndex);
  }

  /**
   * Forecast using Holt-Winters with seasonality
   */
  forecast(metricName, horizonDays = null) {
    const horizon = horizonDays || this.config.forecastHorizon;
    const data = this.historicalData.get(metricName);

    if (!data || data.values.length < this.config.minDataPoints) {
      return null;
    }

    const values = data.values;
    const dates = data.dates;

    // Double exponential smoothing
    const { level, trend } = this._doubleExponentialSmoothing(values);

    // Seasonal indices
    const seasonalIndices = this._calculateSeasonalIndices(
      values,
      this.config.seasonalPeriod
    );

    // Generate predictions
    const predictions = [];
    const forecastDates = [];
    const intervals = [];

    const lastLevel = level[level.length - 1];
    const lastTrend = trend[trend.length - 1];
    const lastDate = dates[dates.length - 1];
    const dayMs = 86400000;

    for (let i = 1; i <= horizon; i++) {
      const seasonalIndex =
        seasonalIndices[(values.length + i - 1) % this.config.seasonalPeriod];
      const prediction = (lastLevel + lastTrend * i) * seasonalIndex;

      // Calculate confidence interval
      const stdError = this._calculateStandardError(values);
      const zScore = this._getZScore(this.config.confidenceLevel);
      const margin = zScore * stdError * Math.sqrt(1 + i / values.length);

      predictions.push(prediction);
      forecastDates.push(lastDate + i * dayMs);
      intervals.push({
        lower: Math.max(0, prediction - margin),
        upper: prediction + margin
      });
    }

    const forecast = {
      metricName,
      forecastDates,
      predictions,
      intervals,
      level: lastLevel,
      trend: lastTrend,
      generatedAt: Date.now(),
      horizon
    };

    this.forecasts.set(metricName, forecast);
    return forecast;
  }

  /**
   * Calculate standard error
   * @private
   */
  _calculateStandardError(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const stddev = Math.sqrt(variance);
    return stddev / Math.sqrt(values.length);
  }

  /**
   * Get Z-score for confidence level
   * @private
   */
  _getZScore(confidenceLevel) {
    const zScores = {
      0.9: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    return zScores[confidenceLevel] || 1.96;
  }

  /**
   * Forecast occupancy
   */
  forecastOccupancy(roomType, horizonDays = null) {
    const metricName = `occupancy:${roomType}`;
    return this.forecast(metricName, horizonDays);
  }

  /**
   * Forecast revenue
   */
  forecastRevenue(horizonDays = null) {
    return this.forecast('revenue', horizonDays);
  }

  /**
   * Get trend direction
   */
  getTrend(metricName) {
    const data = this.historicalData.get(metricName);
    if (!data || data.values.length < 2) return null;

    const values = data.values;
    const recent = values.slice(-7);
    const older = values.slice(-14, -7);

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

    return {
      metricName,
      currentAverage: recentAvg,
      previousAverage: olderAvg,
      changePercent: changePercent.toFixed(2),
      direction: changePercent > 0 ? 'increasing' : 'decreasing',
      momentum: Math.abs(changePercent)
    };
  }

  /**
   * Detect anomalies in forecast vs actual
   */
  detectForecastAnomaly(metricName, actualValue) {
    const forecast = this.forecasts.get(metricName);
    if (!forecast || forecast.predictions.length === 0) return null;

    const nextPrediction = forecast.predictions[0];
    const interval = forecast.intervals[0];

    const isAnomalous =
      actualValue < interval.lower || actualValue > interval.upper;
    const deviation = actualValue - nextPrediction;
    const deviationPercent = (deviation / nextPrediction) * 100;

    return {
      metricName,
      predicted: nextPrediction,
      actual: actualValue,
      deviation,
      deviationPercent: deviationPercent.toFixed(2),
      expectedRange: interval,
      isAnomalous,
      severity: this._calculateAnomalySeverity(deviationPercent)
    };
  }

  /**
   * Calculate anomaly severity
   * @private
   */
  _calculateAnomalySeverity(deviationPercent) {
    const absDeviation = Math.abs(deviationPercent);
    if (absDeviation > 50) return 'critical';
    if (absDeviation > 30) return 'high';
    if (absDeviation > 15) return 'medium';
    return 'low';
  }

  /**
   * Calculate forecast accuracy
   */
  calculateAccuracy(metricName, actualValues) {
    const forecast = this.forecasts.get(metricName);
    if (!forecast) return null;

    const predictions = forecast.predictions.slice(0, actualValues.length);

    // Mean Absolute Percentage Error
    let mapeSum = 0;
    let rmseSum = 0;
    let maeSum = 0;

    for (let i = 0; i < predictions.length; i++) {
      const actual = actualValues[i];
      const predicted = predictions[i];
      const error = Math.abs(actual - predicted);

      mapeSum += (error / actual) * 100;
      rmseSum += Math.pow(error, 2);
      maeSum += error;
    }

    const mape = mapeSum / predictions.length;
    const rmse = Math.sqrt(rmseSum / predictions.length);
    const mae = maeSum / predictions.length;

    this.metrics = { mape, rmse, mae };

    return {
      metricName,
      mape: mape.toFixed(2),
      rmse: rmse.toFixed(2),
      mae: mae.toFixed(2),
      accuracy: Math.max(0, 100 - mape).toFixed(2)
    };
  }

  /**
   * Get demand insights
   */
  getDemandInsights(roomType) {
    const occupancyMetric = `occupancy:${roomType}`;
    const occupancyData = this.historicalData.get(occupancyMetric);

    if (!occupancyData) return null;

    const values = occupancyData.values;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const max = sorted[sorted.length - 1];
    const min = sorted[0];

    const trend = this.getTrend(occupancyMetric);

    // Identify peak periods
    const peakDays = [];
    values.forEach((val, i) => {
      if (val > avg * 1.3) {
        peakDays.push(i);
      }
    });

    return {
      roomType,
      averageOccupancy: avg.toFixed(2),
      medianOccupancy: median.toFixed(2),
      minOccupancy: min,
      maxOccupancy: max,
      occupancyRange: max - min,
      volatility: this._calculateVolatility(values).toFixed(2),
      trend,
      peakPeriodsCount: peakDays.length,
      lowPeriodsCount: values.filter((v) => v < avg * 0.7).length
    };
  }

  /**
   * Calculate volatility (standard deviation)
   * @private
   */
  _calculateVolatility(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    return Math.sqrt(variance);
  }

  /**
   * Resource planning recommendation
   */
  getResourceRecommendation(metricName, resourcesPerUnit = 1) {
    const forecast = this.forecasts.get(metricName);
    if (!forecast) return null;

    const avgPrediction =
      forecast.predictions.reduce((a, b) => a + b, 0) /
      forecast.predictions.length;
    const maxPrediction = Math.max(...forecast.predictions);
    const minPrediction = Math.min(...forecast.predictions);

    return {
      metricName,
      averageDemand: avgPrediction.toFixed(2),
      peakDemand: maxPrediction.toFixed(2),
      minDemand: minPrediction.toFixed(2),
      recommendedResources: {
        minimum: Math.ceil(minPrediction * resourcesPerUnit),
        average: Math.round(avgPrediction * resourcesPerUnit),
        peak: Math.ceil(maxPrediction * resourcesPerUnit)
      }
    };
  }

  /**
   * Get all forecasts
   */
  getAllForecasts() {
    return Array.from(this.forecasts.entries()).map(([name, forecast]) => ({
      metricName: name,
      ...forecast
    }));
  }

  /**
   * Get forecast for specific date
   */
  getForecastForDate(metricName, date) {
    const forecast = this.forecasts.get(metricName);
    if (!forecast) return null;

    const timestamp = typeof date === 'number' ? date : date.getTime();
    const index = forecast.forecastDates.findIndex(
      (d) => Math.abs(d - timestamp) < 86400000
    );

    if (index === -1) return null;

    return {
      metricName,
      date: new Date(forecast.forecastDates[index]),
      prediction: forecast.predictions[index],
      interval: forecast.intervals[index]
    };
  }

  /**
   * Export forecast as CSV
   */
  exportForecastAsCsv(metricName) {
    const forecast = this.forecasts.get(metricName);
    if (!forecast) return null;

    const headers = ['Date', 'Prediction', 'Lower_Bound', 'Upper_Bound'];
    const rows = forecast.forecastDates.map((date, i) => [
      new Date(date).toISOString(),
      forecast.predictions[i].toFixed(2),
      forecast.intervals[i].lower.toFixed(2),
      forecast.intervals[i].upper.toFixed(2)
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: 'healthy',
      metricsTracked: this.historicalData.size,
      forecastsGenerated: this.forecasts.size,
      totalDataPoints: Array.from(this.historicalData.values()).reduce(
        (sum, d) => sum + d.values.length,
        0
      ),
      modelAccuracy:
        this.metrics.mape > 0
          ? `${(100 - parseFloat(this.metrics.mape)).toFixed(2)}%`
          : 'Not calculated',
      config: {
        forecastHorizon: this.config.forecastHorizon,
        seasonalPeriod: this.config.seasonalPeriod,
        confidenceLevel: this.config.confidenceLevel
      },
      timestamp: Date.now()
    };
  }

  /**
   * Clear data
   */
  clear() {
    this.historicalData.clear();
    this.forecasts.clear();
    this.metrics = { mape: 0, rmse: 0, mae: 0 };
  }
}
