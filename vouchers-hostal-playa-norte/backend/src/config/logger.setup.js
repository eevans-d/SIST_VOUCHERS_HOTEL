/**
 * @file logger.setup.js
 * @description Configuración del logger Winston
 */

import winston from 'winston';
import { config } from './app.config.js';

export const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'voucher-system' },
  transports: [
    new winston.transports.File({
      filename: './logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({ filename: './logs/combined.log' })
  ]
});

// En producción, por defecto Winston no loguea a consola.
// Habilitamos consola si no es producción o si LOG_TO_CONSOLE=true (útil en Fly.io)
if (config.nodeEnv !== 'production' || config.logToConsole) {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  );
}
