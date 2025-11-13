/**
 * @file app.config.js
 * @description Configuración de la aplicación
 */

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  dbPath: process.env.DATABASE_PATH || './db/vouchers.db',
  dbEngine: (process.env.DB_ENGINE || 'sqlite').toLowerCase(),
  databaseUrl: process.env.DATABASE_URL,
  logLevel: process.env.LOG_LEVEL || 'info',
  logToConsole: String(process.env.LOG_TO_CONSOLE).toLowerCase() === 'true',
  appVersion: process.env.APP_VERSION || 'unknown',
  jwt: {
    secret:
      process.env.JWT_SECRET ||
      'default-secret-change-in-production-min-32-chars-long!!',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ||
      'default-refresh-secret-change-in-production-min-32-chars'
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10,
  voucherSecret:
    process.env.VOUCHER_SECRET || 'a-very-secret-secret-that-is-long-enough'
};
