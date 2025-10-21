const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config/environment');
const { logger } = require('./config/logger');
const { dbManager } = require('./config/database');
const { correlationMiddleware } = require('./middleware/correlation');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Routes
const vouchersRoutes = require('./routes/vouchers');
const syncRoutes = require('./routes/sync');
const reportsRoutes = require('./routes/reports');

const app = express();

// ============================================
// MIDDLEWARES GLOBALES
// ============================================

// Seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

// CORS
app.use(cors({
  origin: config.ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id']
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Correlation ID
app.use(correlationMiddleware);

// Request logging
app.use((req, res, next) => {
  logger.info({
    event: 'request_received',
    correlation_id: req.correlationId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    user_agent: req.get('user-agent')
  });
  next();
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  const db = dbManager.getDb();
  
  try {
    // Verificar conexión DB
    db.prepare('SELECT 1').get();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: config.APP_VERSION,
      environment: config.NODE_ENV,
      timezone: config.TZ
    });
  } catch (error) {
    logger.error({
      event: 'health_check_failed',
      error: error.message
    });
    
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection failed'
    });
  }
});

// ============================================
// API ROUTES
// ============================================

app.use('/api/vouchers', vouchersRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/reports', reportsRoutes);

// ============================================
// ERROR HANDLERS
// ============================================

// 404 Not Found
app.use(notFoundHandler);

// Error handler global
app.use(errorHandler);

// ============================================
// INICIALIZACIÓN Y SERVIDOR
// ============================================

// Inicializar base de datos
dbManager.initialize();

// Manejo de señales de cierre
process.on('SIGTERM', () => {
  logger.info({ event: 'sigterm_received', message: 'Cerrando servidor...' });
  
  dbManager.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info({ event: 'sigint_received', message: 'Cerrando servidor...' });
  
  dbManager.close();
  process.exit(0);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  logger.error({
    event: 'uncaught_exception',
    error: error.message,
    stack: error.stack
  });
  
  dbManager.close();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({
    event: 'unhandled_rejection',
    reason,
    promise
  });
});

// Iniciar servidor
const PORT = config.PORT;
const server = app.listen(PORT, () => {
  logger.info({
    event: 'server_started',
    port: PORT,
    environment: config.NODE_ENV,
    timezone: config.TZ,
    version: config.APP_VERSION
  });
  
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🏨 Sistema de Vouchers Digitales - Hostal Playa Norte   ║
║                                                           ║
║  Servidor iniciado exitosamente                          ║
║  Puerto: ${PORT}                                              ║
║  Entorno: ${config.NODE_ENV}                                   ║
║  Versión: ${config.APP_VERSION}                                      ║
║  Zona Horaria: ${config.TZ}              ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, server };