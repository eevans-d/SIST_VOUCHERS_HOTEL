import pg from 'pg';
const { Pool } = pg;

/**
 * PostgreSQL Database Adapter
 *
 * Proporciona acceso al pool de conexiones PostgreSQL y helpers para queries.
 * Reemplaza el adaptador SQLite en producción.
 *
 * Configuración:
 * - DATABASE_URL: Connection string PostgreSQL (desde Railway Variables)
 * - Pool size: 20 conexiones máximo (configurable vía MAX_POOL_SIZE)
 * - Timeout: 30 segundos idle, 10 segundos connection
 */

// Pool de conexiones PostgreSQL
let pool = null;

/**
 * Inicializa el pool de conexiones PostgreSQL
 * @param {string} databaseUrl - Connection string PostgreSQL
 * @returns {Pool} Pool de conexiones
 */
export function initializePool(databaseUrl) {
  if (pool) {
    console.warn('[postgres] Pool ya inicializado, reutilizando...');
    return pool;
  }

  if (!databaseUrl) {
    throw new Error('[postgres] DATABASE_URL es requerida');
  }

  const maxPoolSize = parseInt(process.env.MAX_POOL_SIZE || '20', 10);

  pool = new Pool({
    connectionString: databaseUrl,
    max: maxPoolSize,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false } // Railway requiere SSL en prod
      : false
  });

  pool.on('error', (err) => {
    console.error('[postgres] Pool error inesperado:', err);
  });

  pool.on('connect', () => {
    console.warn('[postgres] Nueva conexión establecida al pool');
  });

  console.warn(`[postgres] Pool inicializado con max ${maxPoolSize} conexiones`);
  return pool;
}

/**
 * Obtiene el pool de conexiones PostgreSQL
 * @returns {Pool} Pool de conexiones
 * @throws {Error} Si el pool no ha sido inicializado
 */
export function getPool() {
  if (!pool) {
    throw new Error('[postgres] Pool no inicializado. Llamar initializePool() primero.');
  }
  return pool;
}

/**
 * Cierra el pool de conexiones PostgreSQL
 * Útil para tests y graceful shutdown
 */
export async function closePool() {
  if (pool) {
    console.warn('[postgres] Cerrando pool de conexiones...');
    await pool.end();
    pool = null;
    console.warn('[postgres] Pool cerrado exitosamente');
  }
}

/**
 * Helper: Ejecuta una query simple contra PostgreSQL
 * @param {string} text - Query SQL con placeholders $1, $2, etc.
 * @param {Array} params - Parámetros para la query
 * @returns {Promise<pg.QueryResult>} Resultado de la query
 */
export async function query(text, params = []) {
  const client = getPool();
  const start = Date.now();

  try {
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
      console.warn(`[postgres] Query lenta (${duration}ms): ${text.substring(0, 100)}...`);
    }

    return result;
  } catch (error) {
    console.error('[postgres] Error en query:', {
      text: text.substring(0, 200),
      params: params.map(p => typeof p === 'string' ? p.substring(0, 50) : p),
      error: error.message
    });
    throw error;
  }
}

/**
 * Helper: Ejecuta una transacción con rollback automático en caso de error
 * @param {Function} callback - Función async que recibe el client de transacción
 * @returns {Promise<any>} Resultado del callback
 */
export async function transaction(callback) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[postgres] Transacción rollback:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Helper: Ejecuta una query que retorna una sola fila
 * @param {string} text - Query SQL
 * @param {Array} params - Parámetros
 * @returns {Promise<Object|null>} Primera fila o null
 */
export async function queryOne(text, params = []) {
  const result = await query(text, params);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Helper: Ejecuta una query que retorna múltiples filas
 * @param {string} text - Query SQL
 * @param {Array} params - Parámetros
 * @returns {Promise<Array>} Array de filas
 */
export async function queryMany(text, params = []) {
  const result = await query(text, params);
  return result.rows;
}

/**
 * Helper: Ejecuta un INSERT y retorna la fila insertada (usando RETURNING *)
 * @param {string} text - Query INSERT con RETURNING *
 * @param {Array} params - Parámetros
 * @returns {Promise<Object>} Fila insertada
 */
export async function insert(text, params = []) {
  if (!text.toUpperCase().includes('RETURNING')) {
    text += ' RETURNING *';
  }
  return await queryOne(text, params);
}

/**
 * Helper: Ejecuta un UPDATE y retorna las filas actualizadas (usando RETURNING *)
 * @param {string} text - Query UPDATE con RETURNING *
 * @param {Array} params - Parámetros
 * @returns {Promise<Array>} Filas actualizadas
 */
export async function update(text, params = []) {
  if (!text.toUpperCase().includes('RETURNING')) {
    text += ' RETURNING *';
  }
  return await queryMany(text, params);
}

/**
 * Helper: Ejecuta un DELETE y retorna las filas eliminadas (usando RETURNING *)
 * @param {string} text - Query DELETE con RETURNING *
 * @param {Array} params - Parámetros
 * @returns {Promise<Array>} Filas eliminadas
 */
export async function deleteQuery(text, params = []) {
  if (!text.toUpperCase().includes('RETURNING')) {
    text += ' RETURNING *';
  }
  return await queryMany(text, params);
}

export default {
  initializePool,
  getPool,
  closePool,
  query,
  transaction,
  queryOne,
  queryMany,
  insert,
  update,
  deleteQuery: deleteQuery
};
