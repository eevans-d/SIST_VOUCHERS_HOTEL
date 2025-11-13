// Middleware global de errores HTTP extraído de index.js para reducir complejidad y tamaño.
// Se parametriza para permitir inyección de logger y métrica de errores DB.
import { isSqliteError, mapErrorToStatus, isAuthError } from './error.helpers.js';

export function globalHttpErrorMiddleware({ logger, recordDbError, env }) {
  return function (err, req, res, next) { // eslint-disable-line no-unused-vars
    logger.error('Error no manejado:', { message: err.message, stack: err.stack, path: req.path, method: req.method });
    
    if (isSqliteError(err)) {
      try { recordDbError('query', err.code || err.name || 'unknown'); } catch (_) { /* noop */ }
    }

    const { status, message } = mapErrorToStatus(err.message, env);

    if (isAuthError(status)) {
      logger.warn('Error de autenticación:', { message: err.message, path: req.path });
    }

    return res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
  };
}
