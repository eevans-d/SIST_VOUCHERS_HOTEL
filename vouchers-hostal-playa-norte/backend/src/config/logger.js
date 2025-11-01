import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear directorio de logs
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Formato personalizado
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Logger principal
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: {
    service: 'vouchers-api',
    version: process.env.APP_VERSION || '3.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Logs de error
    new winston.transports.File({
      filename: process.env.LOG_FILE_ERROR || 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // Logs combinados
    new winston.transports.File({
      filename: process.env.LOG_FILE_COMBINED || 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

// Console en desarrollo
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  );
}

// Logger de auditoría (operaciones críticas)
export const auditLogger = winston.createLogger({
  level: 'info',
  format: customFormat,
  defaultMeta: {
    type: 'audit',
    service: 'vouchers-api'
  },
  transports: [
    new winston.transports.File({
      filename: 'logs/audit.log',
      maxsize: 10485760,
      maxFiles: 10
    })
  ]
});

export default { logger, auditLogger };
