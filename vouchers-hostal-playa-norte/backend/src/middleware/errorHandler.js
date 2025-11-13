import { logger } from '../config/logger.js';

// Errores personalizados
class AppError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} no encontrado`, 404, 'NOT_FOUND');
    this.resource = resource;
  }
}

class ConflictError extends AppError {
  constructor(message, details = null) {
    super(message, 409, 'CONFLICT');
    this.details = details;
  }
}

// Middleware de manejo de errores
function errorHandler(err, req, res, _next) {
  const correlationId = req.correlationId || 'unknown';

  // Error operacional esperado
  if (err.isOperational) {
    logger.warn({
      event: 'operational_error',
      correlation_id: correlationId,
      error_code: err.errorCode,
      message: err.message,
      details: err.details,
      path: req.path,
      method: req.method
    });

    return res.status(err.statusCode).json({
      error: err.errorCode,
      message: err.message,
      details: err.details,
      correlation_id: correlationId
    });
  }

  // Error no esperado
  logger.error({
    event: 'unexpected_error',
    correlation_id: correlationId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    user_id: req.user?.id
  });

  // No exponer detalles en producción
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message;

  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message,
    correlation_id: correlationId
  });
}

// Middleware para rutas no encontradas
function notFoundHandler(req, res) {
  logger.warn({
    event: 'route_not_found',
    correlation_id: req.correlationId,
    path: req.path,
    method: req.method
  });

  res.status(404).json({
    error: 'ROUTE_NOT_FOUND',
    message: 'Ruta no encontrada',
    path: req.path
  });
}

export {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  errorHandler,
  notFoundHandler
};
