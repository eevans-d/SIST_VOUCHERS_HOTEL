#!/usr/bin/env node
/*
 * Smoke E2E (sin Playwright):
 * - Siembra la BD e2e
 * - Arranca el backend en modo NODE_ENV=e2e (bypass auth en middleware de API)
 * - Hace requests básicos para validar que no hay 401 y que endpoints clave responden
 * - Apaga el backend al finalizar
 */

import { spawn } from 'node:child_process';
import axios from 'axios';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname; // carpeta backend/
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'db', 'e2e.db');
// Usar puerto alternativo para evitar colisión con otros servicios (e.g. Grafana en 3000)
const PORT = process.env.SMOKE_PORT || '3100';
const BASE_URL = `http://localhost:${PORT}`;

function log(step, msg, extra) {
  // eslint-disable-next-line no-console
  console.log(`[smoke] ${step}: ${msg}`, extra ?? '');
}

function runNode(script, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [script], {
      stdio: 'inherit',
      ...opts
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${script} exited with code ${code}`));
    });
  });
}

async function seedE2E() {
  log('seed', `Sembrando BD en ${DB_PATH}`);
  await runNode('./scripts/seed-e2e.mjs', {
    cwd: ROOT,
    env: { ...process.env, DATABASE_PATH: DB_PATH }
  });
}

function startServer() {
  log('server', 'Iniciando backend (modo e2e)…');
  const child = spawn('node', ['src/index.js'], {
    cwd: ROOT,
  env: { ...process.env, NODE_ENV: 'e2e', DATABASE_PATH: DB_PATH, PORT },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (d) => process.stdout.write(`[backend] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[backend] ${d}`));
  return child;
}

async function waitForHealth(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await axios.get(`${BASE_URL}/health`, { timeout: 1000 });
      if (res.status === 200) return true;
    } catch (_) {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Timeout esperando /health');
}

async function main() {
  await seedE2E();

  const srv = startServer();
  try {
    await waitForHealth();
    log('health', 'OK');

    // 1) Login (bypass e2e devuelve tokens fijos)
  const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@hotel.com',
      password: 'password123'
    }).catch(err => {
      log('auth/login', 'ERROR response', err.response ? { status: err.response.status, data: err.response.data } : err.message);
      throw err;
    });
    log('auth/login', 'RESP', { status: loginRes.status, data: loginRes.data });
    if (!loginRes.data?.success) throw new Error('Login no exitoso');
    log('auth/login', 'OK', loginRes.data?.accessToken);

    // 2) Refresh usando bypass e2e (requiere body.refreshToken)
  const refreshRes = await axios.post(`${BASE_URL}/api/auth/refresh`, {
      refreshToken: 'e2e-refresh-token'
    });
    if (!refreshRes.data?.accessToken) throw new Error('Refresh sin accessToken');
    log('auth/refresh', 'OK');

    // 3) Vouchers list (middleware authenticate bypass en e2e)
  const listRes = await axios.get(`${BASE_URL}/api/vouchers`);
    if (!Array.isArray(listRes.data)) throw new Error('Vouchers GET no devolvió array');
    log('GET /api/vouchers', `OK (count=${listRes.data.length})`);

    // 4) Stats overview
  const statsRes = await axios.get(`${BASE_URL}/api/vouchers/stats/overview`);
    if (!statsRes.data || typeof statsRes.data.totalGenerated === 'undefined') {
      throw new Error('Stats overview inválido');
    }
    log('GET /api/vouchers/stats/overview', 'OK');

    log('resultado', 'SMOKE E2E OK');
    process.exitCode = 0;
  } catch (err) {
    process.exitCode = 1;
    // eslint-disable-next-line no-console
    console.error('\n[smoke] ERROR:', err?.message || err);
  } finally {
    log('server', 'Deteniendo backend…');
    srv.kill('SIGTERM');
  }
}

main();
