/**
 * @file index.js
 * @description Punto de entrada de la aplicación backend
 * @ref BLUEPRINT_ARQUITECTURA.md
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import winston from 'winston';

// Importar servicios y repositorios
import { UserRepository } from './domain/repositories/UserRepository.js';
import { JWTService } from './infrastructure/security/JWTService.js';
import { PasswordService } from './infrastructure/security/PasswordService.js';
import { LoginUser } from './application/use-cases/LoginUser.js';
import { RegisterUser } from './application/use-cases/RegisterUser.js';
import { createAuthRoutes } from './presentation/http/routes/auth.js';

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
    new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: './logs/combined.log' }),
  ],
});

if (NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
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
  process.exit(1);
}

// ==================== INICIALIZAR SERVICIOS ====================

const jwtService = new JWTService(
  process.env.JWT_SECRET || 'default-secret-change-in-production-min-32-chars-long!!',
  process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production-min-32-chars'
);

const passwordService = new PasswordService(
  parseInt(process.env.BCRYPT_ROUNDS) || 10
);

const userRepository = new UserRepository(db);

const loginUser = new LoginUser(userRepository, passwordService, jwtService, logger);
const registerUser = new RegisterUser(userRepository, passwordService, logger);

logger.info('✅ Servicios inicializados correctamente');

// ==================== CREAR APLICACIÓN EXPRESS ====================

const app = express();

// Middleware de seguridad
app.use(helmet());

// CORS
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
    credentials: true,
  })
);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Demasiadas solicitudes desde esta IP',
});
app.use(limiter);

// ==================== RUTAS ====================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

// API de autenticación
app.use(
  '/api/auth',
  createAuthRoutes({
    loginUser,
    registerUser,
    jwtService,
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
    method: req.method,
  });

  // Errores de validación Zod
  if (err instanceof Error && err.message.includes('Datos inválidos')) {
    return res.status(400).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }

  // Errores personalizados de dominio
  if (err.message.includes('no encontrado') || err.message.includes('no existe')) {
    return res.status(404).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }

  // Errores de autenticación
  if (err.message.includes('incorrectos') || err.message.includes('inválidos')) {
    return res.status(401).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }

  // Errores de base de datos
  if (err.message.includes('UNIQUE constraint')) {
    return res.status(409).json({
      success: false,
      error: 'El recurso ya existe',
      timestamp: new Date().toISOString(),
    });
  }

  // Error genérico
  res.status(500).json({
    success: false,
    error: NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message,
    timestamp: new Date().toISOString(),
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.path,
  });
});

// ==================== INICIAR SERVIDOR ====================

const server = app.listen(PORT, () => {
  logger.info(`
╔═══════════════════════════════════════════╗
║   🏛️  SISTEMA VOUCHERS HOTEL              ║
║   Backend API - Constitucional            ║
╚═══════════════════════════════════════════╝

  🌐 URL: http://localhost:${PORT}
  📡 Environment: ${NODE_ENV}
  🗄️  Database: ${DB_PATH}
  
  Rutas disponibles:
  - GET  /health             (Estado de la API)
  - POST /api/auth/register  (Registrar usuario)
  - POST /api/auth/login     (Autenticación)
  - POST /api/auth/logout    (Cerrar sesión)
  - GET  /api/auth/me        (Mi perfil)

  Documentación: docs/API.md
  `);
});

// ==================== GRACEFUL SHUTDOWN ====================

process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido. Cerrando gracefully...');
  server.close(() => {
    db.close();
    logger.info('✅ Servidor cerrado');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT recibido. Cerrando gracefully...');
  server.close(() => {
    db.close();
    logger.info('✅ Servidor cerrado');
    process.exit(0);
  });
});

// Capturar excepciones no manejadas
process.on('uncaughtException', (error) => {
  logger.error('❌ Excepción no manejada:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Promesa rechazada sin manejar:', { reason, promise });
  process.exit(1);
});

export default app;
