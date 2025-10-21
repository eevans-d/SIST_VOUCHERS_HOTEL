const rateLimit = require('express-rate-limit');
const { logger } = require('../config/logger');
const config = require('../config/environment');

// Handler personalizado para rate limit
const rateLimitHandler = (req, res) => {
  logger.warn({
    event: 'rate_limit_exceeded',
    correlation_id: req.correlationId,
    ip: req.ip,
    path: req.path,
    user_id: req.user?.id
  });
  
  res.status(429).json({
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Demasiadas solicitudes. Intente nuevamente en unos momentos.',
    retry_after: res.getHeader('Retry-After')
  });
};

// Limiter para validaciones
const validateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: config.RATE_LIMIT_VALIDATE,
  message: 'Demasiadas validaciones',
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false
});

// Limiter para canjes (por dispositivo)
const redeemLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.RATE_LIMIT_REDEEM,
  keyGenerator: (req) => {
    // Rate limit por dispositivo si está disponible
    return req.body.device_id || req.ip;
  },
  message: 'Límite de canjes excedido',
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false
});

// Limiter para sincronización
const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.RATE_LIMIT_SYNC,
  keyGenerator: (req) => req.body.device_id || req.ip,
  message: 'Límite de sincronizaciones excedido',
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  validateLimiter,
  redeemLimiter,
  syncLimiter
};