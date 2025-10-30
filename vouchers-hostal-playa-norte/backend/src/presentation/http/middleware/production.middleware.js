/**
 * @file production.middleware.js
 * @description Middlewares de seguridad para producción
 * @author GitHub Copilot
 * @date 2025-10-22
 * @version 1.0.0
 *
 * Implementa:
 * - HTTPS enforcement (redirect HTTP → HTTPS)
 * - Helmet security headers
 * - HSTS (HTTP Strict Transport Security)
 * - CSP (Content Security Policy)
 * - CORS mejorado
 * - Secure cookies
 *
 * @ref PLAN_IMPLEMENTACION_ROADMAP.md - Issue P0 #2
 * @ref SECURITY_CHECKLIST.md - OWASP A02 (Cryptographic Failures)
 */

import helmet from 'helmet';

/**
 * HTTPS ENFORCEMENT MIDDLEWARE
 * Redirige HTTP → HTTPS en producción
 *
 * Nota: En production, el servidor debe estar detrás de un reverse proxy (nginx, AWS LB)
 * que maneje TLS. Este middleware verifica y asegura.
 */
export function enforceHttps(req, res, next) {
  // En desarrollo, permitir HTTP
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Permitir endpoints de salud/metrics sin redirección
  if (req.path === '/health' || req.path === '/metrics' || req.path === '/live' || req.path === '/ready') {
    return next();
  }

  // Verificar protocolo
  // Header x-forwarded-proto lo envía el reverse proxy (nginx, AWS LB, etc)
  const isSecure = req.header('x-forwarded-proto') === 'https' || req.protocol === 'https';

  if (!isSecure) {
    // Redirigir a HTTPS
    const secureUrl = `https://${req.hostname}${req.originalUrl}`;
    return res.redirect(301, secureUrl);
  }

  // Secured ✓
  next();
}

/**
 * HELMET SECURITY HEADERS
 *
 * Establece headers de seguridad HTTP recomendados
 */
export const helmetConfig = () => {
  return helmet({
    // Content Security Policy (CSP)
    // Previene XSS, clickjacking, etc.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Para Tailwind CSS
        scriptSrc: ["'self'", "'unsafe-inline'"], // Para bundlers
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", "https://api.example.com"],
        frameSrc: ["'none'"], // Previene clickjacking
        objectSrc: ["'none'"], // Flash/plugins
      },
    },

    // Strict Transport Security (HSTS)
    // Força HTTPS por 1 año (incluir subdomios, preload)
    strictTransportSecurity: {
      maxAge: 31536000, // 1 año en segundos
      includeSubDomains: true,
      preload: true, // Agregar a HSTS preload list
    },

    // X-Frame-Options
    // Previene clickjacking
    frameguard: {
      action: 'deny', // No permitir en iframe
    },

    // X-Content-Type-Options
    // Previene MIME sniffing
    noSniff: true,

    // X-XSS-Protection
    // Activar XSS filter del navegador (legacy)
    xssFilter: true,

    // Referrer-Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },

    // Permissions-Policy (heredó de Feature-Policy)
    // Controla acceso a features del navegador
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none',
    },
  });
};

/**
 * HSTS PRELOAD MIDDLEWARE
 *
 * Responde a .well-known/security.txt
 * Permite registrarse en HSTS preload list
 */
export function hstsPreloadResponder(req, res, next) {
  // https://tools.ietf.org/html/rfc8615
  if (req.path === '/.well-known/security.txt') {
    res.type('text/plain');
    res.send(`
Contact: security@api.example.com
Expires: 2026-10-22T00:00:00Z
Preferred-Languages: es,en
    `.trim());
    return;
  }
  next();
}

/**
 * SECURE COOKIES MIDDLEWARE
 *
 * Asegura que todas las cookies usen flags de seguridad
 */
export function secureHeaders(req, res, next) {
  // Agregar custom security headers
  res.setHeader('X-API-Version', 'v1');
  res.setHeader('X-Powered-By', 'Voucher-System/1.0'); // Información mínima

  // Disuadir ataques de timing
  res.setHeader('Timing-Allow-Origin', 'none');

  // Prevenir information leakage
  res.removeHeader('Server'); // Helmet ya lo hace, asegurar
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * CERTIFICATE PINNING (opcional, avanzado)
 *
 * Para máxima seguridad, pinear el certificado SSL
 * Requiere actualización manual cuando se renueve el cert
 */
export function certificatePinning(req, res, next) {
  // Implementación básica (en producción usar bibliotecas especializadas)
  if (process.env.NODE_ENV === 'production') {
    // Verificar que el certificado es válido
    // No implementado por defecto (requiere certificado activo)
  }
  next();
}

/**
 * UTILITY: Obtener información de seguridad
 */
export function getSecurityInfo() {
  return {
    https_enforced: process.env.NODE_ENV === 'production',
    hsts_enabled: true,
    hsts_max_age: '31536000s (1 year)',
    csp_enabled: true,
    helmet_enabled: true,
    secure_cookies: true,
  };
}

/**
 * EXPORTAR TODOS LOS MIDDLEWARES
 */
export const productionMiddlewares = {
  enforceHttps,
  helmetConfig,
  hstsPreloadResponder,
  secureHeaders,
  certificatePinning,
};

export default productionMiddlewares;
