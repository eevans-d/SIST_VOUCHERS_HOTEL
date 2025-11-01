/**
 * Anomaly Detection Service
 * Detects statistical anomalies in metrics data
 * Issues: #24 → #25 (Distributed Logging → Anomaly Detection)
 *
 * Pattern: Statistical analysis + real-time alerting
 * Features:
 *  - Z-score based anomaly detection
 *  - Dynamic baseline learning
 *  - Real-time metric analysis
 *  - Customizable thresholds
 *  - Alert generation
 */

export default class AnomalyDetectionService {
  constructor(config = {}) {
    this.config = {
      minDataPoints: config.minDataPoints || 30,
      zScoreThreshold: config.zScoreThreshold || 2.5,
      sensitivityLevel: config.sensitivityLevel || 'medium', // low, medium, high
      windowSize: config.windowSize || 3600, // 1 hour in seconds
      retentionHours: config.retentionHours || 72,
      enableAutoLearning: config.enableAutoLearning !== false,
      ...config
    };

    // Data storage
    this.metrics = new Map(); // metric_name -> { values: [], timestamps: [] }
    this.baselines = new Map(); // metric_name -> { mean, stddev, count }
    this.anomalies = []; // Detected anomalies log
    this.alerts = []; // Generated alerts

    // Thresholds by sensitivity
    this.thresholdMultipliers = {
      low: 1.5,
      medium: 2.5,
      high: 3.0
    };
  }

  /**
   * Record a metric value
   * @param {string} metricName - Metric identifier
   * @param {number} value - Metric value
   * @param {object} metadata - Additional context
   */
  recordMetric(metricName, value, metadata = {}) {
    if (!this.metrics.has(metricName)) {
      this.metrics.set(metricName, {
        values: [],
        timestamps: [],
        metadata: metadata
      });
    }

    const metric = this.metrics.get(metricName);
    const now = Date.now();

    metric.values.push(value);
    metric.timestamps.push(now);
    metric.lastValue = value;
    metric.lastTimestamp = now;

    // Cleanup old data
    this._cleanupOldData(metricName);

    // Check for anomalies
    const isAnomaly = this._detectAnomaly(metricName, value);

    if (isAnomaly) {
      this._generateAlert(metricName, value, metadata);
    }

    // Update baseline if enabled
    if (this.config.enableAutoLearning) {
      this._updateBaseline(metricName);
    }

    return {
      metricName,
      value,
      isAnomaly,
      timestamp: now
    };
  }

  /**
   * Batch record multiple metrics
   */
  recordMetrics(metricsData) {
    return metricsData.map(({ metricName, value, metadata }) =>
      this.recordMetric(metricName, value, metadata)
    );
  }

  /**
   * Detect anomaly in metric using Z-score
   * @private
   */
  _detectAnomaly(metricName, value) {
    const metric = this.metrics.get(metricName);
    const baseline = this.baselines.get(metricName);

    // Need minimum data points
    if (!baseline || metric.values.length < this.config.minDataPoints) {
      return false;
    }

    const zScore = this._calculateZScore(value, baseline.mean, baseline.stddev);
    const threshold = this.thresholdMultipliers[this.config.sensitivityLevel];

    return Math.abs(zScore) > threshold;
  }

  /**
   * Calculate Z-score
   * Z = (x - mean) / stddev
   * @private
   */
  _calculateZScore(value, mean, stddev) {
    if (stddev === 0) return 0;
    return (value - mean) / stddev;
  }

  /**
   * Update baseline statistics
   * @private
   */
  _updateBaseline(metricName) {
    const metric = this.metrics.get(metricName);

    if (metric.values.length < this.config.minDataPoints) {
      return;
    }

    const values = metric.values;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => {
        return sum + Math.pow(val - mean, 2);
      }, 0) / values.length;
    const stddev = Math.sqrt(variance);

    this.baselines.set(metricName, {
      mean,
      stddev,
      count: values.length,
      lastUpdated: Date.now()
    });
  }

  /**
   * Generate alert for anomaly
   * @private
   */
  _generateAlert(metricName, value, metadata = {}) {
    const baseline = this.baselines.get(metricName);
    const zScore = this._calculateZScore(value, baseline.mean, baseline.stddev);

    const alert = {
      id: this._generateId(),
      timestamp: Date.now(),
      metricName,
      value,
      baseline: baseline.mean,
      zScore: Math.abs(zScore).toFixed(2),
      severity: this._calculateSeverity(zScore),
      metadata,
      acknowledged: false,
      actions: []
    };

    this.alerts.push(alert);
    this.anomalies.push({
      ...alert,
      type: 'anomaly_detected'
    });

    // Keep last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts.shift();
    }

    return alert;
  }

  /**
   * Calculate alert severity
   * @private
   */
  _calculateSeverity(zScore) {
    const absZ = Math.abs(zScore);
    if (absZ > 4.0) return 'critical';
    if (absZ > 3.0) return 'high';
    if (absZ > 2.0) return 'medium';
    return 'low';
  }

  /**
   * Cleanup old data points
   * @private
   */
  _cleanupOldData(metricName) {
    const metric = this.metrics.get(metricName);
    const cutoffTime = Date.now() - this.config.retentionHours * 3600 * 1000;

    let index = 0;
    while (
      index < metric.timestamps.length &&
      metric.timestamps[index] < cutoffTime
    ) {
      index++;
    }

    if (index > 0) {
      metric.values = metric.values.slice(index);
      metric.timestamps = metric.timestamps.slice(index);
    }
  }

  /**
   * Detect traffic spike
   * Spike = current value > baseline * multiplier
   */
  detectTrafficSpike(metricName, spikeMultiplier = 2.0) {
    const metric = this.metrics.get(metricName);
    const baseline = this.baselines.get(metricName);

    if (!metric || !baseline) {
      return null;
    }

    const isSpiking = metric.lastValue > baseline.mean * spikeMultiplier;

    if (isSpiking) {
      return {
        metricName,
        currentValue: metric.lastValue,
        baselineValue: baseline.mean,
        spikeRatio: (metric.lastValue / baseline.mean).toFixed(2),
        severity: 'high',
        timestamp: metric.lastTimestamp
      };
    }

    return null;
  }

  /**
   * Detect performance degradation
   * Degradation = response time significantly increased
   */
  detectPerformanceDegradation(metricName, degradationThreshold = 1.5) {
    const metric = this.metrics.get(metricName);
    const baseline = this.baselines.get(metricName);

    if (!metric || !baseline) {
      return null;
    }

    const isDegraded = metric.lastValue > baseline.mean * degradationThreshold;

    if (isDegraded) {
      return {
        metricName,
        currentValue: metric.lastValue,
        normalValue: baseline.mean,
        degradationFactor: (metric.lastValue / baseline.mean).toFixed(2),
        severity: 'medium',
        timestamp: metric.lastTimestamp
      };
    }

    return null;
  }

  /**
   * Detect error rate anomaly
   */
  detectErrorRateAnomaly(metricName, errorThreshold = 5.0) {
    const metric = this.metrics.get(metricName);
    const baseline = this.baselines.get(metricName);

    if (!metric || !baseline) {
      return null;
    }

    const errorIncrease = metric.lastValue - baseline.mean;
    const isAnomalous = errorIncrease > baseline.stddev * 2;

    if (isAnomalous) {
      return {
        metricName,
        currentErrorRate: metric.lastValue,
        expectedErrorRate: baseline.mean,
        errorIncrease: errorIncrease.toFixed(2),
        severity: 'high',
        timestamp: metric.lastTimestamp
      };
    }

    return null;
  }

  /**
   * Get anomalies for metric
   */
  getAnomalies(metricName, limit = 100) {
    return this.anomalies
      .filter((a) => a.metricName === metricName)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get all anomalies by severity
   */
  getAnomaliesBySeverity(severity) {
    return this.anomalies
      .filter((a) => a.severity === severity)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return this.alerts
      .filter((a) => !a.acknowledged)
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId, comment = '') {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
      alert.acknowledgedComment = comment;
      alert.actions.push({
        type: 'acknowledged',
        timestamp: Date.now(),
        comment
      });
    }
    return alert;
  }

  /**
   * Analyze metric trend
   */
  analyzeMetricTrend(metricName, windowSize = null) {
    const metric = this.metrics.get(metricName);
    if (!metric || metric.values.length < 2) {
      return null;
    }

    const window = windowSize || this.config.windowSize;
    const cutoffTime = Date.now() - window * 1000;

    const recentIndices = metric.timestamps
      .map((t, i) => (t >= cutoffTime ? i : -1))
      .filter((i) => i >= 0);

    if (recentIndices.length < 2) {
      return null;
    }

    const recentValues = recentIndices.map((i) => metric.values[i]);
    const firstValue = recentValues[0];
    const lastValue = recentValues[recentValues.length - 1];
    const changePercent = (
      ((lastValue - firstValue) / firstValue) *
      100
    ).toFixed(2);

    const trendDirection = lastValue > firstValue ? 'increasing' : 'decreasing';

    return {
      metricName,
      startValue: firstValue,
      endValue: lastValue,
      changePercent: parseFloat(changePercent),
      trendDirection,
      dataPoints: recentValues.length,
      timeWindow: window
    };
  }

  /**
   * Set custom baseline
   */
  setBaseline(metricName, mean, stddev) {
    this.baselines.set(metricName, {
      mean,
      stddev,
      count: 0,
      manual: true,
      lastUpdated: Date.now()
    });
  }

  /**
   * Get baseline statistics
   */
  getBaseline(metricName) {
    return this.baselines.get(metricName) || null;
  }

  /**
   * Get metric statistics
   */
  getMetricStats(metricName) {
    const metric = this.metrics.get(metricName);
    if (!metric || metric.values.length === 0) {
      return null;
    }

    const values = metric.values;
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const stddev = Math.sqrt(variance);

    return {
      metricName,
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: mean.toFixed(2),
      median: sorted[Math.floor(sorted.length / 2)].toFixed(2),
      stddev: stddev.toFixed(2),
      p95: sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
      p99: sorted[Math.floor(sorted.length * 0.99)].toFixed(2)
    };
  }

  /**
   * Get all active metrics
   */
  getActiveMetrics() {
    return Array.from(this.metrics.entries()).map(([name, metric]) => ({
      name,
      lastValue: metric.lastValue,
      lastTimestamp: metric.lastTimestamp,
      dataPoints: metric.values.length,
      baseline: this.baselines.get(name) || null,
      anomalyCount: this.anomalies.filter((a) => a.metricName === name).length
    }));
  }

  /**
   * Clear metric data
   */
  clearMetric(metricName) {
    this.metrics.delete(metricName);
    this.baselines.delete(metricName);
    this.anomalies = this.anomalies.filter((a) => a.metricName !== metricName);
  }

  /**
   * Export anomalies report
   */
  exportAnomaliesReport(format = 'json') {
    const report = {
      exportedAt: new Date().toISOString(),
      totalAnomalies: this.anomalies.length,
      totalAlerts: this.alerts.length,
      activeAlerts: this.getActiveAlerts().length,
      metricsMonitored: this.metrics.size,
      anomaliesBySeverity: {
        critical: this.getAnomaliesBySeverity('critical').length,
        high: this.getAnomaliesBySeverity('high').length,
        medium: this.getAnomaliesBySeverity('medium').length,
        low: this.getAnomaliesBySeverity('low').length
      },
      recentAnomalies: this.anomalies.slice(-10),
      metrics: this.getActiveMetrics()
    };

    if (format === 'json') {
      return report;
    } else if (format === 'csv') {
      return this._convertToCsv(report);
    }

    return report;
  }

  /**
   * Convert report to CSV
   * @private
   */
  _convertToCsv(report) {
    const headers = [
      'Metric',
      'Value',
      'Baseline',
      'Z-Score',
      'Severity',
      'Timestamp'
    ];
    const rows = this.anomalies.map((a) => [
      a.metricName,
      a.value,
      this.baselines.get(a.metricName)?.mean.toFixed(2) || 'N/A',
      a.zScore,
      a.severity,
      new Date(a.timestamp).toISOString()
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return csv;
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: 'healthy',
      metricsTracked: this.metrics.size,
      baselinesLearned: this.baselines.size,
      totalAnomalies: this.anomalies.length,
      unacknowledgedAlerts: this.getActiveAlerts().length,
      config: {
        sensitivityLevel: this.config.sensitivityLevel,
        zScoreThreshold: this.config.zScoreThreshold,
        minDataPoints: this.config.minDataPoints
      },
      timestamp: Date.now()
    };
  }

  /**
   * Generate ID
   * @private
   */
  _generateId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
