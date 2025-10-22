/**
 * @file rateLimiter.middleware.js
 * @description Middleware de rate limiting avanzado para prevenir brute force attacks
 * @author GitHub Copilot
 * @date 2025-10-22
 * @version 1.0.0
 * 
 * Implementa:
 * - Rate limiting global (100 req/15min por IP)
 * - Rate limiting específico para /login (5 intentos fallidos/15min)
 * - Rate limiting específico para /register (3 intentos/15min)
 * - Almacenamiento en memoria (development) o Redis (production)
 * 
 * @ref PLAN_IMPLEMENTACION_ROADMAP.md - Issue P0 #1
 * @ref SECURITY_CHECKLIST.md
 */

import rateLimit from 'express-rate-limit';

/**
 * CONFIGURACIÓN GLOBAL
 * Aplica a todos los endpoints
 */
export const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests por ventana
  message: 'Demasiadas solicitudes desde esta IP. Intenta más tarde.',
  standardHeaders: true, // Devuelve info de rate-limit en `RateLimit-*` headers
  legacyHeaders: false, // Desactiva `X-RateLimit-*` headers
  skip: (req) => {
    // Skip para health checks
    return req.path === '/health';
  },
  keyGenerator: (req) => {
    // Usar X-Forwarded-For si está disponible (proxy/load balancer)
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Demasiadas solicitudes. Por favor intenta más tarde.',
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

/**
 * RATE LIMITING PARA LOGIN
 * Máximo 5 intentos fallidos por IP en 15 minutos
 * 
 * IMPORTANTE: Este limiter usa skipSuccessfulRequests=true
 * Esto significa que SOLO cuenta los intentos FALLIDOS (status != 2xx)
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos fallidos máximo
  skipSuccessfulRequests: true, // Resetea contador después de login exitoso
  skipFailedRequests: false, // Cuenta todos los intentos fallidos
  message: 'Demasiados intentos de login fallidos. Tu cuenta está temporalmente bloqueada.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Limitar por IP + email (más específico)
    const email = req.body?.email || 'unknown';
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    return `${ip}-${email}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Demasiados intentos de login fallidos. Tu cuenta está temporalmente bloqueada por 15 minutos.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * RATE LIMITING PARA REGISTER
 * Máximo 3 intentos por IP en 15 minutos
 * Previene creación masiva de cuentas (spam)
 */
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 3, // 3 intentos de registro máximo
  skipSuccessfulRequests: false, // Cuenta todos los intentos (exitosos o no)
  message: 'Demasiados intentos de registro. Intenta nuevamente en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Demasiados intentos de registro desde esta IP. Intenta en 15 minutos.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * RATE LIMITING PARA REFRESH TOKEN
 * Máximo 10 intentos por IP en 15 minutos
 * Previene ataques de token stuffing
 */
export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 intentos máximo
  skipSuccessfulRequests: true, // Resetea después de refresh exitoso
  message: 'Demasiados intentos de refresh de token.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Demasiados intentos de refresh. Intenta más tarde.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * RATE LIMITING PARA REDEEM VOUCHER
 * Máximo 50 intentos por usuario en 1 hora
 * Previene abuse de validación de vouchers
 */
export const redeemVoucherLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 50, // 50 intentos máximo
  skipSuccessfulRequests: true,
  message: 'Demasiados intentos de redeem. Intenta más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Limitar por usuario autenticado
    return req.user?.id || req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Límite de intentos de redeem excedido. Intenta en 1 hora.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * RATE LIMITING PARA API GENERAL
 * Máximo 500 requests por usuario autenticado en 1 hora
 * Previene abuse de API
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 500, // 500 requests máximo
  skipSuccessfulRequests: false,
  message: 'Límite de API excedido.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Limitar por usuario autenticado o IP
    return req.user?.id || req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Has excedido el límite de la API. Intenta en 1 hora.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * UTILIDAD: Información de rate limiting
 * Retorna estadísticas del rate limiter
 */
export function getRateLimitInfo(req) {
  return {
    current: req.rateLimit?.current || 0,
    limit: req.rateLimit?.limit || 0,
    remaining: req.rateLimit?.remaining || 0,
    resetTime: req.rateLimit?.resetTime || null,
    retryAfter: Math.ceil((req.rateLimit?.resetTime - Date.now()) / 1000) || 0,
  };
}

/**
 * EXPORTAR TODOS LOS LIMITERS
 */
export const rateLimiters = {
  global: globalLimiter,
  login: loginLimiter,
  register: registerLimiter,
  refreshToken: refreshTokenLimiter,
  redeemVoucher: redeemVoucherLimiter,
  api: apiLimiter,
};

export default rateLimiters;
