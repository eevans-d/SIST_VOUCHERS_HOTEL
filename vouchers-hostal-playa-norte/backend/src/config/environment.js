const dotenv = require('dotenv');
const { z } = require('zod');
const { logger } = require('./logger');

// Cargar .env
dotenv.config();

// Schema de validación
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
  TZ: z.string().default('America/Argentina/Buenos_Aires'),

  DATABASE_PATH: z.string().optional(),

  VOUCHER_SECRET: z.string().min(32),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRATION: z.string().default('24h'),

  ALLOWED_ORIGINS: z.string().transform((val) => val.split(',')),

  HOTEL_CODE: z.string().default('HPN'),
  HOTEL_NAME: z.string().default('Hostal Playa Norte'),
  APP_VERSION: z.string().default('3.0.0'),

  ENABLE_OFFLINE_SYNC: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  MAX_SYNC_ATTEMPTS: z.string().regex(/^\d+$/).transform(Number).default('5'),
  SYNC_RETRY_DELAY: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default('300000'),

  RATE_LIMIT_VALIDATE: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default('100'),
  RATE_LIMIT_REDEEM: z.string().regex(/^\d+$/).transform(Number).default('50'),
  RATE_LIMIT_SYNC: z.string().regex(/^\d+$/).transform(Number).default('10'),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info')
});

// Validar y exportar
let config;
try {
  config = envSchema.parse(process.env);

  // Configurar zona horaria
  process.env.TZ = config.TZ;

  logger.info({
    event: 'environment_loaded',
    environment: config.NODE_ENV,
    timezone: config.TZ
  });
} catch (error) {
  logger.error({
    event: 'environment_validation_failed',
    errors: error.errors
  });
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

module.exports = config;
