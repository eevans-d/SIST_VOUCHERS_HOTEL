/**
 * @file routes.setup.js
 * @description Montaje de rutas de la aplicación
 */

import { metricsHandler, recordDbError } from '../middleware/metrics.js';
import { globalHttpErrorMiddleware } from '../presentation/http/middleware/globalError.middleware.js';
import { config } from './app.config.js';
import { logger } from './logger.setup.js';
import { setupProbes } from './routes/probes.js';
import { setupApiRoutes } from './routes/api.js';

export function setupRoutes(app, services, db, pgPool) {
  const { nodeEnv } = config;

  // Health checks y probes
  setupProbes(app, db, pgPool);

  // Métricas Prometheus
  app.get('/metrics', metricsHandler);

  // API routes
  setupApiRoutes(app, services);

  // Error handling
  app.use(globalHttpErrorMiddleware({ logger, recordDbError, env: nodeEnv }));

  // 404
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Ruta no encontrada',
      path: req.path
    });
  });
}
