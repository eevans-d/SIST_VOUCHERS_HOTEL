#!/usr/bin/env node
/*
 * Seed de BD para E2E
 * Crea un esquema mínimo compatible con los repositorios de dominio
 * y un usuario admin por defecto: admin@hotel.com / password123
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const DB_PATH = process.env.DATABASE_PATH || './db/e2e.db';
const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

function log(msg, obj) {
  // eslint-disable-next-line no-console
  console.log(`[seed-e2e] ${msg}`, obj ?? '');
}

function ensureTables(db) {
  db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL,
    passwordHash TEXT NOT NULL,
    isActive INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stays (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    hotelCode TEXT NOT NULL,
    roomNumber TEXT NOT NULL,
    checkInDate TEXT NOT NULL,
    checkOutDate TEXT NOT NULL,
    numberOfGuests INTEGER DEFAULT 1,
    numberOfNights INTEGER DEFAULT 1,
    roomType TEXT,
    basePrice REAL DEFAULT 0,
    totalPrice REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS vouchers (
    id TEXT PRIMARY KEY,
    stayId TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    qrCode TEXT,
    status TEXT NOT NULL,
    redemptionDate TEXT,
    expiryDate TEXT,
    redemptionNotes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (stayId) REFERENCES stays(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    stayId TEXT NOT NULL,
    status TEXT NOT NULL,
    total REAL NOT NULL,
    discountAmount REAL NOT NULL,
    finalTotal REAL NOT NULL,
    notes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (stayId) REFERENCES stays(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    orderId TEXT NOT NULL,
    productCode TEXT NOT NULL,
    productName TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unitPrice REAL NOT NULL,
    subtotal REAL NOT NULL,
    FOREIGN KEY (orderId) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS order_vouchers (
    orderId TEXT NOT NULL,
    voucherId TEXT NOT NULL,
    PRIMARY KEY (orderId, voucherId),
    FOREIGN KEY (orderId) REFERENCES orders(id),
    FOREIGN KEY (voucherId) REFERENCES vouchers(id)
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_stays_user ON stays(userId);
  CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
  CREATE INDEX IF NOT EXISTS idx_orders_stay ON orders(stayId);
  `);
}

function resetData(db) {
  db.exec(`
    DELETE FROM order_vouchers;
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM vouchers;
    DELETE FROM stays;
    DELETE FROM users;
  `);
}

function insertAdmin(db) {
  const id = randomUUID();
  const email = 'admin@hotel.com';
  const passwordHash = bcrypt.hashSync('password123', ROUNDS);
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO users (
      id, email, firstName, lastName, phone, role,
      passwordHash, isActive, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    email,
    'Admin',
    'User',
    null,
    'admin',
    passwordHash,
    1,
    now,
    now
  );

  return { id, email };
}

function main() {
  log(`Usando base de datos: ${DB_PATH}`);
  const db = new Database(DB_PATH);
  ensureTables(db);
  resetData(db);
  const admin = insertAdmin(db);
  log('Usuario admin creado:', admin);
  db.close();
  log('Seed E2E completado');
}

main();
