/**
 * Business Intelligence Dashboard Service
 * Real-time metrics, KPIs, custom widgets, drill-down analysis
 */

class BIDashboardService {
  constructor(config = {}) {
    this.config = {
      refreshInterval: config.refreshInterval || 60000, // 60s
      historicalDays: config.historicalDays || 90,
      cacheTimeout: config.cacheTimeout || 300000, // 5min
      ...config
    };

    this.metrics = new Map();
    this.kpis = new Map();
    this.widgets = new Map();
    this.cache = new Map();
    this.alerts = [];
  }

  // ===== CORE METRICS COLLECTION =====

  recordMetric(category, name, value, metadata = {}) {
    const key = `${category}:${name}`;
    const timestamp = Date.now();

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    this.metrics.get(key).push({
      value,
      timestamp,
      metadata,
      date: new Date().toISOString()
    });

    // Keep only recent data
    this._cleanOldMetrics(key);
    
    // Check for alerts
    this._checkAlerts(category, name, value);

    return { category, name, value, timestamp };
  }

  getMetric(category, name, options = {}) {
    const key = `${category}:${name}`;
    const data = this.metrics.get(key) || [];

    if (options.startDate || options.endDate) {
      return this._filterByDateRange(data, options.startDate, options.endDate);
    }

    if (options.limit) {
      return data.slice(-options.limit);
    }

    return data;
  }

  // ===== KPI MANAGEMENT =====

  defineKPI(id, config) {
    const kpi = {
      id,
      name: config.name,
      description: config.description,
      calculation: config.calculation, // function
      target: config.target,
      threshold: config.threshold || {},
      unit: config.unit || '',
      format: config.format || 'number',
      category: config.category || 'general',
      updateFrequency: config.updateFrequency || 60000
    };

    this.kpis.set(id, kpi);
    return kpi;
  }

  calculateKPI(id) {
    const kpi = this.kpis.get(id);
    if (!kpi) return null;

    const value = kpi.calculation(this);
    const status = this._determineKPIStatus(value, kpi);

    return {
      id,
      name: kpi.name,
      value: this._formatValue(value, kpi.format),
      rawValue: value,
      target: kpi.target,
      status,
      unit: kpi.unit,
      category: kpi.category,
      timestamp: Date.now(),
      trend: this._calculateTrend(id, value)
    };
  }

  getAllKPIs() {
    const results = [];
    for (const [id] of this.kpis) {
      results.push(this.calculateKPI(id));
    }
    return results;
  }

  // ===== DASHBOARD WIDGETS =====

  createWidget(id, config) {
    const widget = {
      id,
      type: config.type, // chart, table, metric, gauge, map
      title: config.title,
      dataSource: config.dataSource, // function
      options: config.options || {},
      position: config.position || { x: 0, y: 0, w: 4, h: 3 },
      refreshInterval: config.refreshInterval || this.config.refreshInterval,
      lastUpdate: null
    };

    this.widgets.set(id, widget);
    return widget;
  }

  getWidget(id) {
    const widget = this.widgets.get(id);
    if (!widget) return null;

    const cacheKey = `widget:${id}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    const data = widget.dataSource(this);
    const result = {
      ...widget,
      data,
      lastUpdate: Date.now()
    };

    this._setCache(cacheKey, result, widget.refreshInterval);
    return result;
  }

  getAllWidgets() {
    const results = [];
    for (const [id] of this.widgets) {
      results.push(this.getWidget(id));
    }
    return results;
  }

  // ===== REAL-TIME DASHBOARD DATA =====

  getDashboardSnapshot() {
    return {
      kpis: this.getAllKPIs(),
      widgets: this.getAllWidgets(),
      alerts: this.getActiveAlerts(),
      summary: this.getSummary(),
      timestamp: Date.now()
    };
  }

  getSummary() {
    const occupancyData = this.getMetric('hotel', 'occupancy');
    const revenueData = this.getMetric('finance', 'revenue');
    const bookingsData = this.getMetric('bookings', 'total');

    const avgOccupancy = this._average(occupancyData.map(d => d.value));
    const totalRevenue = this._sum(revenueData.slice(-30).map(d => d.value)); // Last 30 days
    const totalBookings = this._sum(bookingsData.slice(-30).map(d => d.value));

    return {
      avgOccupancy: avgOccupancy.toFixed(1) + '%',
      totalRevenue: '$' + totalRevenue.toFixed(2),
      totalBookings: totalBookings,
      period: '30 days',
      generatedAt: new Date().toISOString()
    };
  }

  // ===== DRILL-DOWN ANALYSIS =====

  drillDown(category, name, dimension, options = {}) {
    const data = this.getMetric(category, name, options);

    const grouped = {};
    for (const item of data) {
      const key = item.metadata[dimension] || 'unknown';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    }

    const result = Object.entries(grouped).map(([key, values]) => ({
      dimension: key,
      count: values.length,
      sum: this._sum(values.map(v => v.value)),
      avg: this._average(values.map(v => v.value)),
      min: Math.min(...values.map(v => v.value)),
      max: Math.max(...values.map(v => v.value))
    }));

    return result.sort((a, b) => b.sum - a.sum);
  }

  compareTimePeriods(category, name, period1, period2) {
    const data1 = this._filterByDateRange(
      this.getMetric(category, name),
      period1.start,
      period1.end
    );
    const data2 = this._filterByDateRange(
      this.getMetric(category, name),
      period2.start,
      period2.end
    );

    const avg1 = this._average(data1.map(d => d.value));
    const avg2 = this._average(data2.map(d => d.value));
    const change = ((avg1 - avg2) / avg2) * 100;

    return {
      period1: { ...period1, avg: avg1, count: data1.length },
      period2: { ...period2, avg: avg2, count: data2.length },
      change: change.toFixed(2) + '%',
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
    };
  }

  // ===== HISTORICAL TRENDS =====

  getTrend(category, name, period = '7d') {
    const data = this.getMetric(category, name);
    const days = parseInt(period);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const filtered = data.filter(d => d.timestamp >= cutoff);
    const grouped = this._groupByDay(filtered);

    const trend = [];
    for (const [date, values] of Object.entries(grouped)) {
      trend.push({
        date,
        value: this._average(values.map(v => v.value)),
        count: values.length
      });
    }

    return trend.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  getSeasonalPattern(category, name, granularity = 'month') {
    const data = this.getMetric(category, name);
    const grouped = this._groupByPeriod(data, granularity);

    const pattern = [];
    for (const [period, values] of Object.entries(grouped)) {
      pattern.push({
        period,
        avg: this._average(values.map(v => v.value)),
        min: Math.min(...values.map(v => v.value)),
        max: Math.max(...values.map(v => v.value)),
        count: values.length
      });
    }

    return pattern;
  }

  // ===== ALERTS & NOTIFICATIONS =====

  createAlert(config) {
    const alert = {
      id: Date.now().toString(),
      condition: config.condition, // function
      message: config.message,
      severity: config.severity || 'info',
      category: config.category,
      metric: config.metric,
      threshold: config.threshold,
      createdAt: Date.now(),
      active: true
    };

    this.alerts.push(alert);
    return alert;
  }

  _checkAlerts(category, name, value) {
    for (const alert of this.alerts) {
      if (alert.active && alert.category === category && alert.metric === name) {
        if (alert.condition(value, alert.threshold)) {
          alert.triggeredAt = Date.now();
          alert.triggeredValue = value;
          // In production: send notification
        }
      }
    }
  }

  getActiveAlerts() {
    return this.alerts
      .filter(a => a.active && a.triggeredAt && Date.now() - a.triggeredAt < 3600000)
      .sort((a, b) => b.triggeredAt - a.triggeredAt);
  }

  dismissAlert(id) {
    const alert = this.alerts.find(a => a.id === id);
    if (alert) {
      alert.active = false;
      alert.dismissedAt = Date.now();
    }
    return alert;
  }

  // ===== EXPORT & REPORTS =====

  exportData(category, name, format = 'json', options = {}) {
    const data = this.getMetric(category, name, options);

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    if (format === 'csv') {
      if (data.length === 0) return '';
      
      const headers = ['timestamp', 'value', 'date'];
      const rows = data.map(d => [d.timestamp, d.value, d.date].join(','));
      return [headers.join(','), ...rows].join('\n');
    }

    return data;
  }

  generateReport(config) {
    const report = {
      id: Date.now().toString(),
      title: config.title,
      period: config.period,
      sections: [],
      generatedAt: new Date().toISOString()
    };

    for (const section of config.sections) {
      const data = this.getMetric(section.category, section.name, config.period);
      report.sections.push({
        title: section.title,
        data: data,
        summary: {
          count: data.length,
          avg: this._average(data.map(d => d.value)),
          sum: this._sum(data.map(d => d.value))
        }
      });
    }

    return report;
  }

  // ===== UTILITY METHODS =====

  _formatValue(value, format) {
    switch (format) {
      case 'percentage':
        return value.toFixed(1) + '%';
      case 'currency':
        return '$' + value.toFixed(2);
      case 'integer':
        return Math.round(value);
      default:
        return value;
    }
  }

  _determineKPIStatus(value, kpi) {
    if (!kpi.threshold) return 'normal';

    // By default we assume higher values are better. Evaluate from 'good' down to 'critical'.
    if (kpi.threshold.good != null && value >= kpi.threshold.good) {
      return 'good';
    }
    if (kpi.threshold.warning != null && value >= kpi.threshold.warning) {
      return 'warning';
    }
    if (kpi.threshold.critical != null && value >= kpi.threshold.critical) {
      return 'critical';
    }

    return 'normal';
  }

  _calculateTrend(id, currentValue) {
    const kpi = this.kpis.get(id);
    if (!kpi) return null;

    const historical = this.metrics.get(`kpi:${id}`) || [];
    if (historical.length < 2) return 'stable';

    const previousValue = historical[historical.length - 2]?.value || currentValue;
    const change = ((currentValue - previousValue) / previousValue) * 100;

    if (Math.abs(change) < 1) return 'stable';
    return change > 0 ? 'up' : 'down';
  }

  _filterByDateRange(data, startDate, endDate) {
    const start = startDate ? new Date(startDate).getTime() : 0;
    const end = endDate ? new Date(endDate).getTime() : Date.now();

    return data.filter(d => d.timestamp >= start && d.timestamp <= end);
  }

  _groupByDay(data) {
    const grouped = {};
    for (const item of data) {
      const date = new Date(item.timestamp).toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(item);
    }
    return grouped;
  }

  _groupByPeriod(data, granularity) {
    const grouped = {};
    for (const item of data) {
      const date = new Date(item.timestamp);
      let key;
      
      if (granularity === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (granularity === 'week') {
        key = `Week ${this._getWeekNumber(date)}`;
      } else {
        key = date.toISOString().split('T')[0];
      }

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }
    return grouped;
  }

  _getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  _average(values) {
    if (values.length === 0) return 0;
    return this._sum(values) / values.length;
  }

  _sum(values) {
    return values.reduce((acc, val) => acc + val, 0);
  }

  _cleanOldMetrics(key) {
    const data = this.metrics.get(key);
    const cutoff = Date.now() - this.config.historicalDays * 24 * 60 * 60 * 1000;
    this.metrics.set(key, data.filter(d => d.timestamp >= cutoff));
  }

  _getCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }

  _setCache(key, data, ttl) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.cacheTimeout
    });
  }

  // ===== HEALTH & STATS =====

  getStatistics() {
    return {
      metricsCollected: this.metrics.size,
      kpisDefined: this.kpis.size,
      widgetsCreated: this.widgets.size,
      activeAlerts: this.getActiveAlerts().length,
      cacheSize: this.cache.size,
      dataPoints: Array.from(this.metrics.values()).reduce((sum, arr) => sum + arr.length, 0)
    };
  }

  healthCheck() {
    const stats = this.getStatistics();
    return {
      status: stats.dataPoints > 0 ? 'healthy' : 'degraded',
      ...stats,
      timestamp: new Date().toISOString()
    };
  }

  clear() {
    this.metrics.clear();
    this.kpis.clear();
    this.widgets.clear();
    this.cache.clear();
    this.alerts = [];
  }
}

export default BIDashboardService;
