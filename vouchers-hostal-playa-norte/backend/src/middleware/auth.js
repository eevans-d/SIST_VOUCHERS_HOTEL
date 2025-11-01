const jwt = require('jsonwebtoken');
const { logger } = require('../config/logger');
const config = require('../config/environment');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn({
      event: 'auth_missing_token',
      correlation_id: req.correlationId,
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({
      error: 'NO_TOKEN',
      message: 'Token de autenticación requerido'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);

    // Validar estructura del token
    if (!decoded.user_id || !decoded.role) {
      throw new Error('INVALID_TOKEN_STRUCTURE');
    }

    req.user = {
      id: decoded.user_id,
      username: decoded.username,
      role: decoded.role,
      cafeteria_id: decoded.cafeteria_id
    };

    logger.debug({
      event: 'auth_success',
      correlation_id: req.correlationId,
      user_id: req.user.id,
      role: req.user.role
    });

    next();
  } catch (error) {
    logger.warn({
      event: 'auth_invalid_token',
      correlation_id: req.correlationId,
      error: error.message,
      ip: req.ip
    });

    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Token inválido o expirado'
    });
  }
}

// Middleware para roles específicos
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'NOT_AUTHENTICATED',
        message: 'Autenticación requerida'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn({
        event: 'auth_insufficient_permissions',
        correlation_id: req.correlationId,
        user_id: req.user.id,
        user_role: req.user.role,
        required_roles: allowedRoles
      });

      return res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Permisos insuficientes para esta operación'
      });
    }

    next();
  };
}

module.exports = { authMiddleware, requireRole };
