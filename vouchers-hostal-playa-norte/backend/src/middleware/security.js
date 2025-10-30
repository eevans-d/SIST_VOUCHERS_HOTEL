/**
 * @file security.middleware.js
 * @description Middleware centralizado para CORS, CSP y headers de seguridad
 */

import helmet from 'helmet';

/**
 * Determina los orígenes CORS permitidos según el entorno
 */
function getCorsOrigins() {
  const env = process.env.NODE_ENV || 'development';
  const nodeEnv = String(process.env.NODE_ENV).toLowerCase();

  const origins = {
    // Desarrollo local
    development: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ],
    // Staging (si aplica)
    staging: [
      'https://staging-admin.hpn-vouchers.fly.dev',
      'https://hpn-vouchers-backend.fly.dev',
    ],
    // Producción
    production: [
      'https://hpn-vouchers-backend.fly.dev',
      // Si tienes un dominio custom:
      // 'https://vouchers.tudominio.com',
      // Agregar orígenes del frontend cuando esté desplegado:
      // 'https://admin.hpn-vouchers.fly.dev',
    ],
  };

  return origins[nodeEnv] || origins.development;
}

/**
 * Middleware CORS dinámico
 * Valida el origen contra la lista de orígenes permitidos
 */
export function corsMiddleware() {
  const allowedOrigins = getCorsOrigins();

  return (req, res, next) => {
    const origin = req.headers.origin;

    // Permitir requests sin origin (ej: curl, Postman sin headers)
    // o que cumplan la lista de orígenes
    if (!origin || allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin || '*');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, PATCH, OPTIONS'
      );
      res.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With, X-Correlation-ID'
      );
      res.header('Access-Control-Max-Age', '86400'); // 24 horas
    }

    // Preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  };
}

/**
 * Configuración de Helmet mejorada
 * Incluye CSP (Content Security Policy) adaptada
 */
export function helmetMiddleware() {
  const env = process.env.NODE_ENV || 'development';

  // CSP adaptado por entorno
  const cspConfig = {
    development: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Permite inline en dev (para debugging)
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", 'http://localhost:*', 'ws://localhost:*'],
        upgradeInsecureRequests: [],
      },
    },
    production: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"], // No inline en producción
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", 'https://hpn-vouchers-backend.fly.dev'],
        upgradeInsecureRequests: [''], // Fuerza HTTPS
        frameSrc: ["'none'"], // No permitir iframes
        formAction: ["'self'"],
        baseUri: ["'self'"],
      },
      reportOnly: false,
    },
  };

  const selectedCsp = cspConfig[env] || cspConfig.development;

  return helmet({
    contentSecurityPolicy: selectedCsp,
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000, // 1 año
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  });
}

/**
 * Middleware para validar headers requeridos
 */
export function requireSecureHeaders(req, res, next) {
  // Opcional: validar User-Agent para detectar bots maliciosos
  const userAgent = req.headers['user-agent'] || '';

  // En producción, puedes agregar validaciones adicionales
  if (process.env.NODE_ENV === 'production') {
    // Ejemplo: rechazar bots conocidos
    const blockedBots = ['sqlmap', 'nikto', 'nessus'];
    if (blockedBots.some((bot) => userAgent.toLowerCase().includes(bot))) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
  }

  next();
}

export default {
  corsMiddleware,
  helmetMiddleware,
  requireSecureHeaders,
};
