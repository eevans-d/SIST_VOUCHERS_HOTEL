/**
 * @file index.js
 * @description Punto de entrada simplificado de la aplicación backend
 * @ref BLUEPRINT_ARQUITECTURA.md
 */

import express from 'express';
import { config } from './config/app.config.js';
import { logger } from './config/logger.setup.js';
import { initializeDatabases } from './config/database.setup.js';
import { initializeServices } from './config/services.setup.js';
import { setupMiddleware } from './config/middleware.setup.js';
import { setupRoutes } from './config/routes.setup.js';

// Iniciar aplicación
logger.info(`🚀 Iniciando aplicación en modo: ${config.nodeEnv}`);
logger.info(`🗄️  DB_ENGINE configurado: ${config.dbEngine}`);

// Inicializar base de datos
const { db, pgPool } = initializeDatabases();

// Inicializar servicios
const services = initializeServices(db);

// Crear aplicación Express
const app = express();

// Configurar middleware
setupMiddleware(app);

// Configurar rutas
setupRoutes(app, services, db, pgPool);

// Iniciar servidor
let server;
if (config.nodeEnv !== 'test') {
  server = app.listen(config.port, '0.0.0.0', () => {
    logger.info(`
╔═══════════════════════════════════════════╗
║   🏛️  SISTEMA VOUCHERS HOTEL              ║
║   Backend API - Constitucional            ║
╚═══════════════════════════════════════════╝

  🌐 URL: http://localhost:${config.port}
  📡 Environment: ${config.nodeEnv}
  🗄️  Database (sqlite path): ${config.dbPath}
  🧪 Engine: ${config.dbEngine}${pgPool ? ' (PG pool activo)' : ''}
  ⚠️  Modo híbrido: repositorios aún usan SQLite. Migración a PostgreSQL en curso.

  Rutas disponibles:
  - GET  /live               (Liveness)
  - GET  /health             (Estado de la API)
  - GET  /ready              (Readiness)
  - POST /api/auth/register  (Registrar usuario)
  - POST /api/auth/login     (Autenticación)
  - POST /api/auth/logout    (Cerrar sesión)
  - GET  /api/auth/me        (Mi perfil)

  - GET    /api/stays              (Listar estadías)
  - GET    /api/stays/:id          (Obtener estadía)
  - POST   /api/stays              (Crear estadía)
  - PUT    /api/stays/:id          (Actualizar)
  - DELETE /api/stays/:id          (Cancelar)
  - POST   /api/stays/:id/activate (Activar)
  - POST   /api/stays/:id/complete (Completar)
  - GET    /api/stays/occupancy/:hotelCode (Ocupación)
  - GET    /api/stays/checkpoints/:hotelCode (Check-in/out hoy)

  Documentación: docs/API.md
  `);
  });
}

// Graceful shutdown
function gracefulShutdown(signal) {
  logger.info(`${signal} recibido. Cerrando gracefully...`);
  if (server) {
    server.close(() => {
      db.close();
      logger.info('✅ Servidor cerrado');
      process.exit(0);
    });
  } else {
    db.close();
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Capturar excepciones no manejadas
process.on('uncaughtException', (error) => {
  try {
    logger.error('❌ Excepción no manejada:', error);
  } catch (_) {
    /* noop */
  }
  // eslint-disable-next-line no-console
  console.error('❌ Excepción no manejada (fallback):', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, _promise) => {
  try {
    logger.error('❌ Promesa rechazada sin manejar:', { reason });
  } catch (_) {
    /* noop */
  }
  // eslint-disable-next-line no-console
  console.error('❌ Promesa rechazada sin manejar (fallback):', reason);
  process.exit(1);
});

export default app;
