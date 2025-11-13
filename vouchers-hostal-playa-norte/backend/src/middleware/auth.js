const { logger } = require('../config/logger');
const config = require('../config/environment');
const {
  extractToken,
  decodeToken,
  mapDecodedToUser,
  unauthorized,
  invalidToken,
  forbidden
} = require('./helpers/auth.helpers');

function authMiddleware(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    logger.warn({
      event: 'auth_missing_token',
      correlation_id: req.correlationId,
      ip: req.ip,
      path: req.path
    });
    return unauthorized(res);
  }

  try {
    const decoded = decodeToken(token, config.JWT_SECRET);
    req.user = mapDecodedToUser(decoded);

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
    return invalidToken(res);
  }
}

// Middleware para roles específicos
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return unauthorized(res, 'Autenticación requerida', 'NOT_AUTHENTICATED');
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn({
        event: 'auth_insufficient_permissions',
        correlation_id: req.correlationId,
        user_id: req.user.id,
        user_role: req.user.role,
        required_roles: allowedRoles
      });
      return forbidden(res);
    }

    next();
  };
}

module.exports = { authMiddleware, requireRole };
