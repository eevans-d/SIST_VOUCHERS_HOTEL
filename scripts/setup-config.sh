#!/bin/bash

##############################################################################
# SETUP CONSTITUTIONAL CONFIGURATION
# Crea archivos de configuración base para logging, seguridad, observabilidad
#
# Uso: bash scripts/setup-config.sh
# Duración: ~30 segundos
# Pilares: 2.1, 5.1, 6.1, 9.1
##############################################################################

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ ${NC}$1"; }
log_success() { echo -e "${GREEN}✅ ${NC}$1"; }
log_warn() { echo -e "${YELLOW}⚠️  ${NC}$1"; }
log_error() { echo -e "${RED}❌ ${NC}$1"; }

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/vouchers-hostal-playa-norte/backend"

log_info "=========================================="
log_info "CONSTITUTIONAL CONFIGURATION SETUP"
log_info "=========================================="

##############################################################################
# 1. CREATE .env TEMPLATE
##############################################################################
log_info ""
log_info "Creating .env template (Pilar 5.1 - Secrets Management)..."

cat > "$BACKEND_DIR/.env.example" << 'EOF'
# ========== ENVIRONMENT ==========
NODE_ENV=development
APP_VERSION=1.0.0
PORT=3000
HOST=0.0.0.0

# ========== SECURITY (ROTATE EVERY 90 DAYS) ==========
# Generate with: openssl rand -hex 32
JWT_SECRET=your-32-byte-hex-secret-here
VOUCHER_SECRET=your-32-byte-hex-secret-here
JWT_EXPIRATION=24h

# ========== DATABASE ==========
DATABASE_PATH=./vouchers.sqlite
DATABASE_TIMEOUT=5000
DATABASE_JOURNAL_MODE=WAL

# ========== LOGGING (PILAR 6.1) ==========
LOG_LEVEL=info
LOG_DIR=./logs
LOG_FORMAT=json
LOG_MAX_FILES=10
LOG_MAX_SIZE=10485760

# ========== OBSERVABILITY (PILAR 6.2) ==========
METRICS_ENABLED=true
METRICS_PORT=9090
JAEGER_ENABLED=false
JAEGER_ENDPOINT=http://localhost:14268/api/traces

# ========== RATE LIMITING (PILAR 5.1) ==========
RATE_LIMIT_VALIDATE=100
RATE_LIMIT_REDEEM=50
RATE_LIMIT_SYNC=10
RATE_LIMIT_WINDOW_MS=60000

# ========== CORS (PILAR 5.1) ==========
CORS_ORIGIN=http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3001,https://yourdomain.com

# ========== TIMEZONE ==========
TZ=America/Argentina/Buenos_Aires

# ========== DEPLOYMENT (FLY.IO) ==========
# Set in Fly.io Secrets, not here
# FLY_APP_NAME=voucher-system
# DATABASE_BACKUP_BUCKET=your-s3-bucket
EOF

log_success "Created .env.example"

if [ ! -f "$BACKEND_DIR/.env" ]; then
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    log_warn ".env created from template - FILL IN SECRETS!"
else
    log_warn ".env already exists, skipping creation"
fi

##############################################################################
# 2. CREATE WINSTON LOGGER CONFIG
##############################################################################
log_info ""
log_info "Creating Logger configuration (Pilar 6.1)..."

cat > "$BACKEND_DIR/src/infrastructure/observability/logger-config.js" << 'EOF'
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logDir = process.env.LOG_DIR || './logs';

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      service: 'voucher-system',
      version: process.env.APP_VERSION || '1.0.0',
      ...metadata
    });
  })
);

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  })
];

// File transports in production
if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: parseInt(process.env.LOG_MAX_SIZE || 10485760),
      maxFiles: parseInt(process.env.LOG_MAX_FILES || 10)
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: parseInt(process.env.LOG_MAX_SIZE || 10485760),
      maxFiles: parseInt(process.env.LOG_MAX_FILES || 10)
    })
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format,
  defaultMeta: {
    service: 'voucher-system'
  },
  transports
});

export default logger;
EOF

log_success "Created logger-config.js (Pilar 6.1)"

##############################################################################
# 3. CREATE DATABASE CONFIG
##############################################################################
log_info ""
log_info "Creating Database configuration..."

cat > "$BACKEND_DIR/src/infrastructure/config/database-config.js" << 'EOF'
export const databaseConfig = {
  path: process.env.DATABASE_PATH || './vouchers.sqlite',
  timeout: parseInt(process.env.DATABASE_TIMEOUT || 5000),
  journalMode: process.env.DATABASE_JOURNAL_MODE || 'WAL',
  wal: true,
  
  // Connection pool settings
  connectionPool: {
    min: 1,
    max: 10
  },

  // Transaction settings
  transaction: {
    timeout: 30000,
    isolation: 'SERIALIZABLE'
  }
};

export default databaseConfig;
EOF

log_success "Created database-config.js"

##############################################################################
# 4. CREATE SECURITY CONFIG
##############################################################################
log_info ""
log_info "Creating Security configuration (Pilar 5.1)..."

cat > "$BACKEND_DIR/src/infrastructure/security/security-config.js" << 'EOF'
export const securityConfig = {
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'CHANGE_ME_IN_ENV',
    expiration: process.env.JWT_EXPIRATION || '24h',
    issuer: 'hostal-playa-norte',
    algorithm: 'HS256'
  },

  // Voucher HMAC
  voucher: {
    secret: process.env.VOUCHER_SECRET || 'CHANGE_ME_IN_ENV',
    algorithm: 'sha256'
  },

  // Rate Limiting (Pilar 5.1)
  rateLimiting: {
    validate: parseInt(process.env.RATE_LIMIT_VALIDATE || 100),
    redeem: parseInt(process.env.RATE_LIMIT_REDEEM || 50),
    sync: parseInt(process.env.RATE_LIMIT_SYNC || 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || 60000)
  },

  // CORS (Pilar 5.1)
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Correlation-ID']
  },

  // Helmet (Pilar 5.1)
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }
};

export default securityConfig;
EOF

log_success "Created security-config.js (Pilar 5.1)"

##############################################################################
# 5. CREATE OBSERVABILITY CONFIG
##############################################################################
log_info ""
log_info "Creating Observability configuration (Pilar 6.2)..."

cat > "$BACKEND_DIR/src/infrastructure/observability/metrics-config.js" << 'EOF'
export const metricsConfig = {
  enabled: process.env.METRICS_ENABLED === 'true',
  port: parseInt(process.env.METRICS_PORT || 9090),
  endpoint: '/metrics',
  
  // Buckets para latencia (en segundos)
  latencyBuckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],

  // KPIs técnicos
  kpis: {
    technical: {
      latencyP95Target: 500, // ms
      uptimeTarget: 99.9, // %
      errorRateTarget: 1 // %
    },
    business: {
      adoptionTarget: 95, // %
      satisfactionTarget: 4.5 // /5
    }
  }
};

export default metricsConfig;
EOF

log_success "Created metrics-config.js (Pilar 6.2)"

##############################################################################
# 6. CREATE ROLLUP CONFIG
##############################################################################
log_info ""
log_info "Creating deployment configuration..."

cat > "$BACKEND_DIR/.env.production" << 'EOF'
NODE_ENV=production
LOG_LEVEL=warn
DATABASE_JOURNAL_MODE=WAL
CORS_ORIGIN=https://your-domain.com
METRICS_ENABLED=true
EOF

log_success "Created .env.production"

##############################################################################
# 7. CREATE SECRETS MANAGER SCRIPT
##############################################################################
log_info ""
log_info "Creating Secrets Manager script..."

cat > "$PROJECT_ROOT/scripts/generate-secrets.sh" << 'EOF'
#!/bin/bash

# Generate secrets for .env
echo "Generating constitutional secrets (Pilar 5.1)..."

JWT_SECRET=$(openssl rand -hex 32)
VOUCHER_SECRET=$(openssl rand -hex 32)

echo ""
echo "🔐 COPY THESE SECRETS TO .env (NOT in version control!):"
echo ""
echo "JWT_SECRET=$JWT_SECRET"
echo "VOUCHER_SECRET=$VOUCHER_SECRET"
echo ""
echo "⚠️  NEVER commit these secrets to git"
echo "✅ For production, use Fly.io Secrets:"
echo "   flyctl secrets set JWT_SECRET=$JWT_SECRET"
echo "   flyctl secrets set VOUCHER_SECRET=$VOUCHER_SECRET"
EOF

chmod +x "$PROJECT_ROOT/scripts/generate-secrets.sh"
log_success "Created generate-secrets.sh"

##############################################################################
# SUMMARY
##############################################################################
log_info ""
log_success "=========================================="
log_success "CONSTITUTIONAL CONFIGURATION CREATED"
log_success "=========================================="
log_info ""

log_info "Files Created:"
echo "  • .env.example (template with all variables)"
echo "  • .env (from template, edit with your values)"
echo "  • .env.production (for Fly.io)"
echo "  • src/infrastructure/observability/logger-config.js"
echo "  • src/infrastructure/config/database-config.js"
echo "  • src/infrastructure/security/security-config.js"
echo "  • src/infrastructure/observability/metrics-config.js"
echo "  • scripts/generate-secrets.sh"
echo ""

log_warn "NEXT STEPS:"
echo ""
echo "1. Generate secrets:"
echo "   bash scripts/generate-secrets.sh"
echo ""
echo "2. Update .env with your values:"
echo "   nano vouchers-hostal-playa-norte/backend/.env"
echo ""
echo "3. Create log directory:"
echo "   mkdir -p vouchers-hostal-playa-norte/backend/logs"
echo ""
echo "4. Verify configuration:"
echo "   cat vouchers-hostal-playa-norte/backend/.env"
echo ""

log_success "Configuration Setup Complete! ✨"
