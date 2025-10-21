const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Base de datos de test
const TEST_DB_PATH = path.join(__dirname, '../test.db');

// Setup global antes de todos los tests
beforeAll(() => {
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
});

// Cleanup después de todos los tests
afterAll(() => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

// Helpers globales para tests
global.createTestDB = () => {
  const db = new Database(TEST_DB_PATH);
  
  // Cargar schema
  const schema = fs.readFileSync(
    path.join(__dirname, '../db/schema.sql'),
    'utf8'
  );
  db.exec(schema);
  
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