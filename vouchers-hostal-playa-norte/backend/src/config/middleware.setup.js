/**
 * @file middleware.setup.js
 * @description Configuración de middleware Express
 */

import express from 'express';
import { globalLimiter } from '../presentation/http/middleware/rateLimiter.middleware.js';
import {
  enforceHttps,
  helmetConfig,
  hstsPreloadResponder,
  secureHeaders
} from '../presentation/http/middleware/production.middleware.js';
import {
  corsMiddleware,
  helmetMiddleware,
  requireSecureHeaders
} from '../middleware/security.js';
import {
  metricsMiddleware,
  registerDefaultMetrics
} from '../middleware/metrics.js';
import { logger } from './logger.setup.js';

export function setupMiddleware(app) {
  // Seguridad - HTTPS enforcement
  app.use(enforceHttps);
  logger.info('✅ HTTPS enforcement activado');

  // Seguridad - Helmet headers
  app.use(helmetConfig());
  logger.info('✅ Helmet security headers configurados');

  // Seguridad - Well-known security
  app.use(hstsPreloadResponder);

  // Seguridad - Secure custom headers
  app.use(secureHeaders);

  // Seguridad - Helmet mejorado (CORS + CSP dinámico)
  app.use(helmetMiddleware());
  logger.info('✅ Helmet mejorado con CSP dinámico');

  // Seguridad - CORS dinámico por entorno
  app.use(corsMiddleware());
  logger.info('✅ CORS dinámico configurado por entorno');

  // Seguridad - Validación de headers
  app.use(requireSecureHeaders);

  // Métricas - Prometheus
  registerDefaultMetrics();
  app.use(metricsMiddleware());
  logger.info('✅ Métricas Prometheus registradas');

  // Body parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Rate limiting
  app.use(globalLimiter);
  logger.info('✅ Rate limiting global activado (100 req/15min)');
}
