/**
 * prometheusService.js
 * 
 * Servicio de monitoreo con Prometheus
 * - Métricas: Counters, Gauges, Histograms, Summaries
 * - Exposición en /metrics (Prometheus format)
 * - Dashboards predefinidos
 * - Alerting rules
 * - Integración con servicios existentes
 * - Performance: <1ms overhead por métrica
 */

class PrometheusService {
  constructor(options = {}) {
    this.namespace = options.namespace || 'hostal';
    this.subsystem = options.subsystem || 'api';
    this.labels = options.labels || {};
    this.metrics = new Map();
    this.histogramBuckets = options.histogramBuckets || [
      0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10
    ];
    this.stats = {
      metricsRegistered: 0,
      measurementsRecorded: 0,
      errors: 0,
    };
  }

  /**
   * Registra métrica Counter
   * @param {string} name - Nombre de métrica
   * @param {string} help - Descripción
   * @param {array} labels - Labels opcionales
   * @returns {object} Métrica registrada
   */
  registerCounter(name, help, labels = []) {
    const fullName = `${this.namespace}_${this.subsystem}_${name}`;
    
    const metric = {
      type: 'counter',
      name: fullName,
      help,
      labels,
      value: 0,
      values: new Map(),  // Para tracked por labels
      
      inc: (amount = 1, labelValues = {}) => {
        metric.value += amount;
        this.recordMeasurement();
        
        if (Object.keys(labelValues).length > 0) {
          const key = JSON.stringify(labelValues);
          metric.values.set(key, (metric.values.get(key) || 0) + amount);
        }
      },
      
      get: () => metric.value,
      getLabeled: () => metric.values,
    };

    this.metrics.set(fullName, metric);
    this.stats.metricsRegistered++;
    return metric;
  }

  /**
   * Registra métrica Gauge
   * @param {string} name - Nombre de métrica
   * @param {string} help - Descripción
   * @param {array} labels - Labels opcionales
   * @returns {object} Métrica registrada
   */
  registerGauge(name, help, labels = []) {
    const fullName = `${this.namespace}_${this.subsystem}_${name}`;
    
    const metric = {
      type: 'gauge',
      name: fullName,
      help,
      labels,
      value: 0,
      values: new Map(),
      
      set: (value, labelValues = {}) => {
        metric.value = value;
        this.recordMeasurement();
        
        if (Object.keys(labelValues).length > 0) {
          const key = JSON.stringify(labelValues);
          metric.values.set(key, value);
        }
      },
      
      inc: (amount = 1) => {
        metric.value += amount;
        this.recordMeasurement();
      },
      
      dec: (amount = 1) => {
        metric.value -= amount;
        this.recordMeasurement();
      },
      
      get: () => metric.value,
      getLabeled: () => metric.values,
    };

    this.metrics.set(fullName, metric);
    this.stats.metricsRegistered++;
    return metric;
  }

  /**
   * Registra métrica Histogram
   * @param {string} name - Nombre de métrica
   * @param {string} help - Descripción
   * @param {array} labels - Labels opcionales
   * @returns {object} Métrica registrada
   */
  registerHistogram(name, help, labels = [], buckets = null) {
    const fullName = `${this.namespace}_${this.subsystem}_${name}`;
    const histogram_buckets = buckets || this.histogramBuckets;
    
    const metric = {
      type: 'histogram',
      name: fullName,
      help,
      labels,
      buckets: histogram_buckets.map(b => ({
        le: b,
        count: 0,
      })),
      sum: 0,
      count: 0,
      observations: [],
      
      observe: (value, labelValues = {}) => {
        metric.count++;
        metric.sum += value;
        metric.observations.push(value);
        this.recordMeasurement();
        
        // Actualizar buckets
        for (const bucket of metric.buckets) {
          if (value <= bucket.le) {
            bucket.count++;
          }
        }
      },
      
      get: () => ({
        buckets: metric.buckets,
        sum: metric.sum,
        count: metric.count,
        mean: metric.count > 0 ? metric.sum / metric.count : 0,
        median: this.calculatePercentile(metric.observations, 0.5),
        p95: this.calculatePercentile(metric.observations, 0.95),
        p99: this.calculatePercentile(metric.observations, 0.99),
      }),
    };

    this.metrics.set(fullName, metric);
    this.stats.metricsRegistered++;
    return metric;
  }

  /**
   * Registra métrica Summary
   * @param {string} name - Nombre de métrica
   * @param {string} help - Descripción
   * @param {array} labels - Labels opcionales
   * @returns {object} Métrica registrada
   */
  registerSummary(name, help, labels = []) {
    const fullName = `${this.namespace}_${this.subsystem}_${name}`;
    
    const metric = {
      type: 'summary',
      name: fullName,
      help,
      labels,
      sum: 0,
      count: 0,
      observations: [],
      
      observe: (value) => {
        metric.count++;
        metric.sum += value;
        metric.observations.push(value);
        this.recordMeasurement();
      },
      
      get: () => ({
        sum: metric.sum,
        count: metric.count,
        mean: metric.count > 0 ? metric.sum / metric.count : 0,
        min: Math.min(...metric.observations),
        max: Math.max(...metric.observations),
        p50: this.calculatePercentile(metric.observations, 0.5),
        p90: this.calculatePercentile(metric.observations, 0.9),
        p99: this.calculatePercentile(metric.observations, 0.99),
      }),
    };

    this.metrics.set(fullName, metric);
    this.stats.metricsRegistered++;
    return metric;
  }

  /**
   * Exporta métricas en formato Prometheus
   * @returns {string} Formato de texto Prometheus
   */
  exportMetrics() {
    let output = '';

    for (const [name, metric] of this.metrics) {
      // Comentario de ayuda
      output += `# HELP ${name} ${metric.help}\n`;
      output += `# TYPE ${name} ${metric.type}\n`;

      // Valor de métrica
      if (metric.type === 'counter' || metric.type === 'gauge') {
        output += `${name}${this.formatLabels({})} ${metric.value}\n`;

        // Valores con labels
        for (const [labelKey, value] of metric.values) {
          const labels = JSON.parse(labelKey);
          output += `${name}${this.formatLabels(labels)} ${value}\n`;
        }
      }

      // Histogram
      if (metric.type === 'histogram') {
        const data = metric.get();
        
        for (const bucket of data.buckets) {
          output += `${name}_bucket{le="${bucket.le}"} ${bucket.count}\n`;
        }
        output += `${name}_bucket{le="+Inf"} ${metric.count}\n`;
        output += `${name}_sum {} ${data.sum}\n`;
        output += `${name}_count {} ${data.count}\n`;
      }

      // Summary
      if (metric.type === 'summary') {
        const data = metric.get();
        output += `${name}_sum {} ${data.sum}\n`;
        output += `${name}_count {} ${data.count}\n`;
      }

      output += '\n';
    }

    return output;
  }

  /**
   * Middleware Express para exponer métricas
   * @param {object} options - Opciones
   * @returns {function} Middleware
   */
  metricsMiddleware(options = {}) {
    const metricsPath = options.path || '/metrics';

    return (req, res, next) => {
      if (req.path === metricsPath) {
        res.set('Content-Type', 'text/plain; version=0.0.4');
        res.send(this.exportMetrics());
        return;
      }

      next();
    };
  }

  /**
   * Middleware para registrar latencias de request
   * @returns {function} Middleware
   */
  requestLatencyMiddleware() {
    // Registrar métrica si no existe
    if (!this.metrics.has(`${this.namespace}_${this.subsystem}_http_request_duration_seconds`)) {
      this.registerHistogram(
        'http_request_duration_seconds',
        'HTTP request latency in seconds',
        ['method', 'path', 'status']
      );
    }

    const histogram = this.metrics.get(`${this.namespace}_${this.subsystem}_http_request_duration_seconds`);

    return (req, res, next) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        histogram.observe(duration, {
          method: req.method,
          path: req.path,
          status: res.statusCode,
        });
      });

      next();
    };
  }

  /**
   * Middleware para contar requests por endpoint
   * @returns {function} Middleware
   */
  requestCounterMiddleware() {
    if (!this.metrics.has(`${this.namespace}_${this.subsystem}_http_requests_total`)) {
      this.registerCounter(
        'http_requests_total',
        'Total HTTP requests',
        ['method', 'path', 'status']
      );
    }

    const counter = this.metrics.get(`${this.namespace}_${this.subsystem}_http_requests_total`);

    return (req, res, next) => {
      res.on('finish', () => {
        counter.inc(1, {
          method: req.method,
          path: req.path,
          status: res.statusCode,
        });
      });

      next();
    };
  }

  /**
   * Middleware para rastrear excepciones
   * @returns {function} Middleware
   */
  errorCounterMiddleware() {
    if (!this.metrics.has(`${this.namespace}_${this.subsystem}_http_errors_total`)) {
      this.registerCounter(
        'http_errors_total',
        'Total HTTP errors',
        ['method', 'path', 'error_type']
      );
    }

    const counter = this.metrics.get(`${this.namespace}_${this.subsystem}_http_errors_total`);

    return (err, req, res, next) => {
      counter.inc(1, {
        method: req.method,
        path: req.path,
        error_type: err.name || 'UnknownError',
      });

      next(err);
    };
  }

  /**
   * Gauge para rastrear conexiones activas
   * @returns {object} Métrica gauge
   */
  createActiveConnectionsGauge() {
    return this.registerGauge(
      'active_connections',
      'Number of active connections'
    );
  }

  /**
   * Counter para rastrear operaciones de BD
   * @returns {object} Métrica counter
   */
  createDatabaseOperationsCounter() {
    return this.registerCounter(
      'database_operations_total',
      'Total database operations',
      ['operation', 'table']
    );
  }

  /**
   * Histogram para latencias de BD
   * @returns {object} Métrica histogram
   */
  createDatabaseLatencyHistogram() {
    return this.registerHistogram(
      'database_query_duration_seconds',
      'Database query duration in seconds',
      ['operation', 'table']
    );
  }

  /**
   * Gauge para tamaño de caché
   * @returns {object} Métrica gauge
   */
  createCacheSizeGauge() {
    return this.registerGauge(
      'cache_size_bytes',
      'Size of cache in bytes',
      ['cache_name']
    );
  }

  /**
   * Counter para hits/misses de caché
   * @returns {object} Métricas counters
   */
  createCacheHitMissCounters() {
    const hits = this.registerCounter(
      'cache_hits_total',
      'Total cache hits',
      ['cache_name']
    );

    const misses = this.registerCounter(
      'cache_misses_total',
      'Total cache misses',
      ['cache_name']
    );

    return { hits, misses };
  }

  /**
   * Obtiene alerting rules
   * @returns {array} Array de rules
   */
  getAlertingRules() {
    return [
      {
        alert: 'HighErrorRate',
        expr: 'rate(hostal_api_http_errors_total[5m]) > 0.05',
        for: '5m',
        annotations: {
          summary: 'High HTTP error rate detected',
          description: 'Error rate > 5% in the last 5 minutes',
        },
      },
      {
        alert: 'HighLatency',
        expr: 'histogram_quantile(0.99, hostal_api_http_request_duration_seconds) > 1',
        for: '5m',
        annotations: {
          summary: 'High request latency detected',
          description: 'P99 latency > 1s',
        },
      },
      {
        alert: 'DatabaseSlow',
        expr: 'histogram_quantile(0.95, hostal_api_database_query_duration_seconds) > 0.5',
        for: '5m',
        annotations: {
          summary: 'Database queries are slow',
          description: 'P95 query time > 500ms',
        },
      },
      {
        alert: 'CacheHighMissRate',
        expr: 'rate(hostal_api_cache_misses_total[5m]) > 0.3',
        for: '5m',
        annotations: {
          summary: 'High cache miss rate',
          description: 'Cache miss rate > 30%',
        },
      },
    ];
  }

  /**
   * Obtiene dashboard Grafana
   * @returns {object} Dashboard JSON
   */
  getGrafanaDashboard() {
    return {
      dashboard: {
        title: 'Hostal API Metrics',
        description: 'Main dashboard for API monitoring',
        timezone: 'browser',
        panels: [
          {
            title: 'Request Rate (req/sec)',
            targets: [
              {
                expr: 'rate(hostal_api_http_requests_total[1m])',
              },
            ],
            type: 'graph',
          },
          {
            title: 'Error Rate',
            targets: [
              {
                expr: 'rate(hostal_api_http_errors_total[1m])',
              },
            ],
            type: 'graph',
          },
          {
            title: 'P95 Latency',
            targets: [
              {
                expr: 'histogram_quantile(0.95, hostal_api_http_request_duration_seconds)',
              },
            ],
            type: 'stat',
          },
          {
            title: 'Database Query Latency',
            targets: [
              {
                expr: 'histogram_quantile(0.95, hostal_api_database_query_duration_seconds)',
              },
            ],
            type: 'graph',
          },
          {
            title: 'Cache Hit Rate',
            targets: [
              {
                expr: 'rate(hostal_api_cache_hits_total[5m]) / (rate(hostal_api_cache_hits_total[5m]) + rate(hostal_api_cache_misses_total[5m]))',
              },
            ],
            type: 'stat',
          },
        ],
      },
    };
  }

  /**
   * Métodos auxiliares
   */

  formatLabels(labels) {
    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }

    const parts = Object.entries(labels)
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');

    return `{${parts}}`;
  }

  calculatePercentile(observations, percentile) {
    if (observations.length === 0) return 0;

    const sorted = [...observations].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  recordMeasurement() {
    this.stats.measurementsRecorded++;
  }

  getStats() {
    return {
      metricsRegistered: this.stats.metricsRegistered,
      measurementsRecorded: this.stats.measurementsRecorded,
      errors: this.stats.errors,
    };
  }

  healthCheck() {
    return {
      healthy: true,
      serviceName: 'PrometheusService',
      timestamp: new Date(),
      stats: this.getStats(),
      metricsCount: this.metrics.size,
    };
  }
}

export default PrometheusService;
