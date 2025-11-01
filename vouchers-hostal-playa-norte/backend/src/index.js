/**
 * @file index.js
 * @description Punto de entrada de la aplicación backend
 * @ref BLUEPRINT_ARQUITECTURA.md
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import winston from 'winston';

// Importar servicios y repositorios
import { UserRepository } from './domain/repositories/UserRepository.js';
import { StayRepository } from './domain/repositories/StayRepository.js';
import { VoucherRepository } from './domain/repositories/VoucherRepository.js';
import { OrderRepository } from './domain/repositories/OrderRepository.js';
import { JWTService } from './infrastructure/security/JWTService.js';
import { PasswordService } from './infrastructure/security/PasswordService.js';
import { QRService } from './infrastructure/services/QRService.js';
import { CryptoService } from './infrastructure/security/CryptoService.js';
import { LoginUser } from './application/use-cases/LoginUser.js';
import { RegisterUser } from './application/use-cases/RegisterUser.js';
import { CreateStay } from './application/use-cases/CreateStay.js';
import { GenerateVoucher } from './application/use-cases/GenerateVoucher.js';
import { ValidateVoucher } from './application/use-cases/ValidateVoucher.js';
import { RedeemVoucher } from './application/use-cases/RedeemVoucher.js';
import { CreateOrder } from './application/use-cases/CreateOrder.js';
import { CompleteOrder } from './application/use-cases/CompleteOrder.js';
import { ReportService } from './application/services/ReportService.js';
import { createAuthRoutes } from './presentation/http/routes/auth.js';
import { createStaysRoutes } from './presentation/http/routes/stays.js';
import createVouchersRoutes from './presentation/http/routes/vouchers.js';
import { createOrdersRoutes } from './presentation/http/routes/orders.js';
import { createReportsRoutes } from './presentation/http/routes/reports.js';
import {
  authenticate,
  authorize
} from './presentation/http/middleware/auth.middleware.js';
import {
  globalLimiter,
  loginLimiter,
  registerLimiter,
  refreshTokenLimiter,
  redeemVoucherLimiter
} from './presentation/http/middleware/rateLimiter.middleware.js';
import {
  enforceHttps,
  helmetConfig,
  hstsPreloadResponder,
  secureHeaders
} from './presentation/http/middleware/production.middleware.js';
import {
  corsMiddleware,
  helmetMiddleware,
  requireSecureHeaders
} from './middleware/security.js';
import {
  metricsMiddleware,
  metricsHandler,
  registerDefaultMetrics,
  recordDbError
} from './middleware/metrics.js';

// Cargar variables de entorno
dotenv.config();

// ==================== CONFIGURACIÓN ====================

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DB_PATH = process.env.DATABASE_PATH || './db/vouchers.db';

// Logger Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'voucher-system' },
  transports: [
    new winston.transports.File({
      filename: './logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({ filename: './logs/combined.log' })
  ]
});

// En producción, por defecto Winston no loguea a consola.
// Habilitamos consola si no es producción o si LOG_TO_CONSOLE=true (útil en Fly.io)
if (
  NODE_ENV !== 'production' ||
  String(process.env.LOG_TO_CONSOLE).toLowerCase() === 'true'
) {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  );
}

logger.info(`🚀 Iniciando aplicación en modo: ${NODE_ENV}`);

// ==================== INICIALIZAR BASE DE DATOS ====================

let db;
try {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  logger.info(`✅ Base de datos conectada: ${DB_PATH}`);
} catch (error) {
  logger.error('❌ Error conectando a base de datos:', error);
  // Registrar métrica de error de base de datos
  recordDbError('connect', error.code || error.name || 'unknown');
  process.exit(1);
}

// ==================== INICIALIZAR SERVICIOS ====================

const jwtService = new JWTService(
  process.env.JWT_SECRET ||
    'default-secret-change-in-production-min-32-chars-long!!',
  process.env.JWT_REFRESH_SECRET ||
    'default-refresh-secret-change-in-production-min-32-chars'
);

const passwordService = new PasswordService(
  parseInt(process.env.BCRYPT_ROUNDS) || 10
);

const userRepository = new UserRepository(db);
const stayRepository = new StayRepository(db);
const voucherRepository = new VoucherRepository(db);
const orderRepository = new OrderRepository(db);

const loginUser = new LoginUser(
  userRepository,
  passwordService,
  jwtService,
  logger
);
const registerUser = new RegisterUser(userRepository, passwordService, logger);
const createStay = new CreateStay(stayRepository, userRepository, logger);

const qrService = new QRService({
  size: 250,
  margin: 10,
  errorCorrection: 'M'
});

const cryptoService = new CryptoService(
  process.env.VOUCHER_SECRET || 'a-very-secret-secret-that-is-long-enough'
);

const generateVoucher = new GenerateVoucher(
  stayRepository,
  voucherRepository,
  cryptoService,
  logger
);
const validateVoucher = new ValidateVoucher(
  voucherRepository,
  stayRepository,
  cryptoService,
  logger
);
const redeemVoucher = new RedeemVoucher(voucherRepository, logger);

const createOrder = new CreateOrder(stayRepository, orderRepository, logger);
const completeOrder = new CompleteOrder(
  orderRepository,
  voucherRepository,
  logger
);

const reportService = new ReportService({
  stayRepository,
  orderRepository,
  voucherRepository,
  logger
});

logger.info('✅ Servicios inicializados correctamente');

// ==================== CREAR APLICACIÓN EXPRESS ====================

const app = express();

// 🔒 SEGURIDAD - HTTPS ENFORCEMENT (P0)
// Redirigir HTTP → HTTPS en producción
app.use(enforceHttps);
logger.info('✅ HTTPS enforcement activado');

// 🔒 SEGURIDAD - HELMET HEADERS
// Content-Security-Policy, X-Frame-Options, HSTS, etc.
app.use(helmetConfig());
logger.info('✅ Helmet security headers configurados');

// 🔒 SEGURIDAD - WELL-KNOWN SECURITY
app.use(hstsPreloadResponder);

// 🔒 SEGURIDAD - SECURE CUSTOM HEADERS
app.use(secureHeaders);

// 🔒 SEGURIDAD - HELMET MEJORADO (CORS + CSP dinámico)
app.use(helmetMiddleware());
logger.info('✅ Helmet mejorado con CSP dinámico');

// 🔒 SEGURIDAD - CORS DINÁMICO POR ENTORNO
app.use(corsMiddleware());
logger.info('✅ CORS dinámico configurado por entorno');

// 🔒 SEGURIDAD - VALIDACIÓN DE HEADERS
app.use(requireSecureHeaders);

// 📈 MÉTRICAS - PROMETHEUS
registerDefaultMetrics();
app.use(metricsMiddleware());
logger.info('✅ Métricas Prometheus registradas');

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 🔒 Rate limiting - SEGURIDAD CRÍTICA (P0)
// Global: 100 req/15min por IP
app.use(globalLimiter);
logger.info('✅ Rate limiting global activado (100 req/15min)');

// ==================== RUTAS ====================

// Liveness probe
app.get('/live', (req, res) => {
  res.json({
    status: 'live',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
    version: process.env.APP_VERSION || 'unknown'
  });
});

// Health check
app.get('/health', (req, res) => {
  // Intentar una operación simple en DB para validar conexión
  let dbStatus = 'connected';
  try {
    db.prepare('SELECT 1').get();
  } catch (e) {
    dbStatus = 'error';
    // Registrar fallo en health check de DB
    recordDbError('health_check', e.code || e.name || 'unknown');
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: process.env.APP_VERSION || 'unknown',
    uptime_seconds: Math.round(process.uptime()),
    database: dbStatus
  });
});

// Readiness probe
app.get('/ready', (req, res) => {
  // Verificar dependencias críticas (DB)
  try {
    db.prepare('SELECT 1').get();
    return res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      version: process.env.APP_VERSION || 'unknown',
      uptime_seconds: Math.round(process.uptime()),
      database: 'connected'
    });
  } catch (e) {
    recordDbError('health_check', e.code || e.name || 'unknown');
    return res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      version: process.env.APP_VERSION || 'unknown',
      uptime_seconds: Math.round(process.uptime()),
      database: 'error',
      error: NODE_ENV === 'production' ? undefined : e.message
    });
  }
});

// Endpoint de métricas Prometheus
app.get('/metrics', metricsHandler);

// API de autenticación
app.use(
  '/api/auth',
  createAuthRoutes({
    loginUser,
    registerUser,
    jwtService
  })
);

// API de estadías
app.use(
  '/api/stays',
  createStaysRoutes({
    createStay,
    stayRepository,
    userRepository
  })
);

// API de vouchers
app.use(
  '/api/vouchers',
  createVouchersRoutes({
    generateVoucher,
    validateVoucher,
    redeemVoucher,
    jwtService
  })
);

// API de órdenes
app.use(
  createOrdersRoutes({
    orderRepository,
    stayRepository,
    createOrder,
    completeOrder,
    logger
  })
);

// API de reportes
app.use(
  '/api/reports',
  createReportsRoutes({
    reportService,
    authenticate,
    authorize,
    logger
  })
);

// ==================== MANEJO DE ERRORES ====================

/**
 * Middleware de manejo de errores global
 */
app.use((err, req, res, next) => {
  logger.error('Error no manejado:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Métrica para errores de base de datos detectables
  if (
    err &&
    (err.name === 'SqliteError' ||
      (err.code && String(err.code).startsWith('SQLITE')))
  ) {
    recordDbError('query', err.code || err.name || 'unknown');
  }

  // Errores de validación Zod
  if (err instanceof Error && err.message.includes('Datos inválidos')) {
    return res.status(400).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }

  // Errores personalizados de dominio
  if (
    err.message.includes('no encontrado') ||
    err.message.includes('no existe')
  ) {
    return res.status(404).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }

  // Errores de autenticación
  if (
    err.message.includes('incorrectos') ||
    err.message.includes('inválidos')
  ) {
    return res.status(401).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }

  // Errores de base de datos
  if (err.message.includes('UNIQUE constraint')) {
    return res.status(409).json({
      success: false,
      error: 'El recurso ya existe',
      timestamp: new Date().toISOString()
    });
  }

  // Error genérico
  res.status(500).json({
    success: false,
    error:
      NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
    timestamp: new Date().toISOString()
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.path
  });
});

// ==================== INICIAR SERVIDOR ====================

let server;
if (NODE_ENV !== 'test') {
  server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`
╔═══════════════════════════════════════════╗
║   🏛️  SISTEMA VOUCHERS HOTEL              ║
║   Backend API - Constitucional            ║
╚═══════════════════════════════════════════╝

  🌐 URL: http://localhost:${PORT}
  📡 Environment: ${NODE_ENV}
  🗄️  Database: ${DB_PATH}

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

// ==================== GRACEFUL SHUTDOWN ====================

process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido. Cerrando gracefully...');
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
});

process.on('SIGINT', () => {
  logger.info('SIGINT recibido. Cerrando gracefully...');
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
});

// Capturar excepciones no manejadas (imprimir también a consola por si el logger falla)
process.on('uncaughtException', (error) => {
  try {
    logger.error('❌ Excepción no manejada:', error);
  } catch (_) {
    /* noop */
  }
  // Fallback a consola
  // eslint-disable-next-line no-console
  console.error('❌ Excepción no manejada (fallback):', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  try {
    logger.error('❌ Promesa rechazada sin manejar:', { reason, promise });
  } catch (_) {
    /* noop */
  }
  // eslint-disable-next-line no-console
  console.error('❌ Promesa rechazada sin manejar (fallback):', reason);
  process.exit(1);
});

export default app;
// Husky test
