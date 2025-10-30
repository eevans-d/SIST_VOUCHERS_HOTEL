/**
 * @file metrics.js
 * @description Middleware y registro de métricas Prometheus
 */

import client from 'prom-client';

const register = new client.Registry();

// Labels por defecto para todas las métricas
const defaultLabels = {
  app: process.env.APP_NAME || 'voucher-system',
  env: process.env.NODE_ENV || 'development',
  version: process.env.APP_VERSION || 'unknown',
};
register.setDefaultLabels(defaultLabels);

// Métricas por defecto de proceso/node
client.collectDefaultMetrics({ register });

// Contador de requests HTTP
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total de requests HTTP',
  labelNames: ['method', 'route', 'status_code'],
});
register.registerMetric(httpRequestsTotal);

// Histograma de duración de requests
const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de requests HTTP en segundos',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5],
});
register.registerMetric(httpRequestDurationSeconds);

// Contador de errores HTTP (5xx)
const httpServerErrorsTotal = new client.Counter({
  name: 'http_server_errors_total',
  help: 'Total de errores 5xx en el servidor',
  labelNames: ['route', 'status_code'],
});
register.registerMetric(httpServerErrorsTotal);

// Contador de errores de base de datos
const dbErrorsTotal = new client.Counter({
  name: 'db_errors_total',
  help: 'Total de errores en operaciones de base de datos',
  labelNames: ['operation', 'error_code'],
});
register.registerMetric(dbErrorsTotal);

/**
 * Middleware de instrumentación de métricas HTTP
 */
export function metricsMiddleware() {
  return (req, res, next) => {
    const start = process.hrtime.bigint();

    // Determinar ruta amigable (evitar incluir IDs concretos)
    const routeLabel = req.route?.path || req.path || 'unknown';

    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const durationSeconds = Number(end - start) / 1e9;
      const labels = {
        method: req.method,
        route: routeLabel,
        status_code: String(res.statusCode),
      };

      httpRequestsTotal.inc(labels);
      httpRequestDurationSeconds.observe(labels, durationSeconds);

      if (res.statusCode >= 500) {
        httpServerErrorsTotal.inc({ route: routeLabel, status_code: String(res.statusCode) });
      }
    });

    next();
  };
}

/**
 * Handler para exponer /metrics
 */
export async function metricsHandler(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (err) {
    res.status(500).send('# Metrics collection error');
  }
}

/**
 * Registro explícito de métricas por defecto (por si se requiere llamar desde index)
 */
export function registerDefaultMetrics() {
  // No-op: collectDefaultMetrics ya fue llamado arriba
  return register;
}

/**
 * Registrar un error de base de datos en métricas
 * @param {string} operation - Operación: connect|query|insert|update|delete|transaction|health_check
 * @param {string} [errorCode] - Código de error o nombre (p.ej. SQLITE_CONSTRAINT)
 */
export function recordDbError(operation, errorCode = 'unknown') {
  try {
    dbErrorsTotal.inc({ operation, error_code: String(errorCode) });
  } catch (_e) {
    // Evitar que fallas en métricas afecten al flujo principal
  }
}

export default {
  metricsMiddleware,
  metricsHandler,
  registerDefaultMetrics,
  recordDbError,
  register,
};
