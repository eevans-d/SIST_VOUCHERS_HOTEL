/**
 * @file routes/probes.js
 * @description Health check y readiness probes
 */

import { recordDbError } from '../../middleware/metrics.js';
import { config } from '../app.config.js';

function checkSqlite(db) {
  try {
    db.prepare('SELECT 1').get();
    return { ok: true, status: 'connected' };
  } catch (e) {
    recordDbError('health_check_sqlite', e.code || e.name || 'unknown');
    return { ok: false, status: 'error' };
  }
}

async function checkPostgres(pgPool) {
  if (!pgPool) return { ok: true, status: 'disabled' };

  try {
    await pgPool.query('SELECT 1');
    return { ok: true, status: 'connected' };
  } catch (e) {
    recordDbError('health_check_postgres', e.code || e.name || 'unknown');
    return { ok: false, status: 'error' };
  }
}

function buildDbStatus(dbEngine, sqliteCheck, postgresCheck) {
  return {
    primary: 'sqlite',
    engine: dbEngine,
    sqlite: sqliteCheck.status,
    postgres: postgresCheck.status
  };
}

function buildBaseResponse(nodeEnv, appVersion) {
  return {
    timestamp: new Date().toISOString(),
    environment: nodeEnv,
    version: appVersion,
    uptime_seconds: Math.round(process.uptime())
  };
}

export function setupProbes(app, db, pgPool) {
  const { nodeEnv, dbEngine, appVersion } = config;

  // Liveness probe
  app.get('/live', (req, res) => {
    res.json({
      status: 'live',
      ...buildBaseResponse(nodeEnv, appVersion)
    });
  });

  // Health check
  app.get('/health', async (req, res) => {
    const sqliteCheck = checkSqlite(db);
    const postgresCheck = await checkPostgres(pgPool);

    res.json({
      status: 'ok',
      ...buildBaseResponse(nodeEnv, appVersion),
      database: buildDbStatus(dbEngine, sqliteCheck, postgresCheck)
    });
  });

  // Readiness probe
  app.get('/ready', async (req, res) => {
    const sqliteCheck = checkSqlite(db);
    const postgresCheck = await checkPostgres(pgPool);
    const allOk = sqliteCheck.ok && postgresCheck.ok;

    const response = {
      status: allOk ? 'ready' : 'not_ready',
      ...buildBaseResponse(nodeEnv, appVersion),
      database: buildDbStatus(dbEngine, sqliteCheck, postgresCheck)
    };

    if (!allOk && nodeEnv !== 'production') {
      response.error = 'Dependencias críticas no listas';
    }

    res.status(allOk ? 200 : 503).json(response);
  });
}
