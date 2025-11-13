#!/usr/bin/env node
/**
 * @file smoke-pg.mjs
 * @description Script de smoke test para entorno híbrido PostgreSQL.
 * Verifica endpoints /health y /ready y estado de conexión PG si DB_ENGINE=postgres.
 * Uso:
 *   node scripts/smoke-pg.mjs [baseUrl]
 *   BASE_URL=https://backend.example.com node scripts/smoke-pg.mjs
 */

import dotenv from 'dotenv';

dotenv.config();

const baseUrl = process.env.BASE_URL || process.argv[2] || `http://localhost:${process.env.PORT || 3000}`;
const engine = (process.env.DB_ENGINE || 'sqlite').toLowerCase();

async function fetchJson(path) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' }, timeout: 10000 }).catch(e => ({ ok: false, status: 0, error: e }));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al obtener ${url}`);
  }
  return await res.json();
}

(async () => {
  console.log(`\n🚀 Smoke PG - Base URL: ${baseUrl}`);
  console.log(`🔧 DB_ENGINE=${engine}`);

  let health, ready;
  let failures = 0;

  try {
    health = await fetchJson('/health');
    console.log('✅ /health OK');
  } catch (e) {
    console.error('❌ /health fallo:', e.message);
    failures++;
  }

  try {
    ready = await fetchJson('/ready');
    console.log('✅ /ready OK');
  } catch (e) {
    console.error('❌ /ready fallo:', e.message);
    failures++;
  }

  if (health) {
    const pgStatus = health.database?.postgres;
    console.log(`🗄️  Estado SQLite: ${health.database?.sqlite}`);
    console.log(`🐘 Estado PostgreSQL: ${pgStatus}`);
    if (engine === 'postgres' && pgStatus !== 'connected') {
      console.error('⚠️  PostgreSQL no está conectado correctamente (engine=postgres).');
      failures++;
    }
  }

  if (ready) {
    if (ready.status !== 'ready') {
      console.error(`⚠️  Readiness no alcanzado: status=${ready.status}`);
      failures++;
    }
  }

  if (failures === 0) {
    console.log('\n🎉 Smoke test PG exitoso');
    process.exit(0);
  } else {
    console.error(`\n❌ Smoke test PG con ${failures} fallos`);
    process.exit(1);
  }
})();
