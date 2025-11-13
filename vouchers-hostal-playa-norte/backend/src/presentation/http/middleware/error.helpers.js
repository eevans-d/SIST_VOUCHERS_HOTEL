/**
 * Helpers para clasificación y mapeo de errores HTTP.
 * Reduce complejidad ciclomática del middleware global de errores.
 */

/**
 * Detecta si un error es de tipo SQLite/base de datos.
 */
export function isSqliteError(err) {
  return err && (err.name === 'SqliteError' || (err.code && String(err.code).startsWith('SQLITE')));
}

/**
 * Mapea el mensaje de error a código de estado HTTP apropiado.
 * Devuelve { status, message } donde message puede ser el mensaje original o uno genérico.
 */
export function mapErrorToStatus(errorMessage, env) {
  const msg = errorMessage || 'Error';
  
  // Validación
  if (msg.includes('Datos inválidos')) {
    return { status: 400, message: msg };
  }
  
  // No encontrado
  if (msg.includes('no encontrado') || msg.includes('no existe')) {
    return { status: 404, message: msg };
  }
  
  // Autenticación
  if (/(incorrectos|inválidos|incorrecta)/.test(msg)) {
    return { status: 401, message: msg };
  }
  
  // Conflicto
  if (msg.includes('UNIQUE constraint')) {
    return { status: 409, message: 'El recurso ya existe' };
  }
  
  // Error genérico de servidor
  return {
    status: 500,
    message: env === 'production' ? 'Error interno del servidor' : msg
  };
}

/**
 * Determina si el error debe generar warning de autenticación.
 */
export function isAuthError(status) {
  return status === 401;
}
