/**
 * Jest setup utilities for tests
 * Import this file in test suites that need setup
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base de datos de test
export const TEST_DB_PATH = path.join(__dirname, '../test.db');

// Setup function to call in test files
export function setupTestDB() {
  // Limpiar DB de test si existe
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // Configurar variables de entorno para testing
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = TEST_DB_PATH;
  process.env.VOUCHER_SECRET = 'test-voucher-secret-32-bytes-long-string';
  process.env.JWT_SECRET = 'test-jwt-secret-32-bytes-long-string';
  process.env.TZ = 'America/Argentina/Buenos_Aires';
  process.env.LOG_LEVEL = 'error';
}

// Cleanup function to call after tests
export function cleanupTestDB() {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}

// Helpers globales para tests
global.createTestDB = () => {
  const db = new Database(TEST_DB_PATH);
  
  // Cargar schema
  try {
    const schema = fs.readFileSync(
      path.join(__dirname, '../db/schema.sql'),
      'utf8'
    );
    db.exec(schema);
  } catch (e) {
    // Schema no existe yet, ok para tests simples
  }
  
  return db;
};

global.cleanupTestDB = (db) => {
  if (db) {
    db.close();
  }
};

global.generateTestToken = (userId, role) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { user_id: userId, role, username: 'test' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};