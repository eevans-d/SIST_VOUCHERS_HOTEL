#!/bin/bash

##############################################################################
# SETUP DEPENDENCIES - CONSTITUTIONAL BACKEND
# Crea package.json con todas las dependencias necesarias
# alineadas con los 12 pilares constitucionales
#
# Uso: bash scripts/setup-dependencies.sh
# Duración: ~1 minuto (sin instalar)
# Pilares: 2.1 (Estándares), 5.1 (Seguridad), 6.1 (Observabilidad), 9.1 (CI/CD)
##############################################################################

set -e

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ ${NC}$1"; }
log_success() { echo -e "${GREEN}✅ ${NC}$1"; }
log_warn() { echo -e "${YELLOW}⚠️  ${NC}$1"; }

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT/vouchers-hostal-playa-norte/backend"

log_info "=========================================="
log_info "CONSTITUTIONAL DEPENDENCIES SETUP"
log_info "=========================================="

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "npm not found. Please install Node.js 18+"
    exit 1
fi

# Create package.json if it doesn't exist
if [ ! -f "package.json" ]; then
    log_info "Creating package.json..."
    
    cat > package.json << 'EOF'
{
  "name": "voucher-system-backend",
  "version": "1.0.0",
  "description": "Sistema de Vouchers Digitales - Backend Constitutional",
  "main": "src/index.js",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "lint": "eslint src/ tests/",
    "lint:fix": "eslint src/ tests/ --fix",
    "format": "prettier --write src/ tests/",
    "test": "jest --forceExit --detectOpenHandles",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest tests/unit/ --coverage",
    "test:integration": "jest tests/integration/ --forceExit --detectOpenHandles",
    "test:e2e": "jest tests/e2e/ --forceExit --detectOpenHandles",
    "test:smoke": "jest tests/smoke/ --forceExit --detectOpenHandles",
    "db:migrate": "node scripts/migrate.js",
    "db:seed": "node scripts/seed.js",
    "db:reset": "node scripts/reset-db.js",
    "build": "npm run lint && npm run test:coverage",
    "precommit": "npm run lint && npm run test:unit"
  },
  "keywords": [
    "vouchers",
    "hotel",
    "offline-first",
    "pwa",
    "constitutional"
  ],
  "author": "Hostal Playa Norte",
  "license": "PRIVATE",
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^9.2.2",
    "jsonwebtoken": "^9.1.2",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.3.1",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.5",
    "zod": "^3.22.4",
    "winston": "^3.11.0",
    "prom-client": "^15.0.0",
    "uuid": "^9.0.1",
    "qrcode": "^1.5.3",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "eslint": "^8.55.0",
    "prettier": "^3.1.0",
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "nodemon": "^3.0.2",
    "jest-mock-extended": "^3.0.5"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
EOF
    
    log_success "package.json created"
else
    log_warn "package.json already exists, skipping creation"
fi

log_info ""
log_info "Dependencies Overview:"
echo ""
echo "🔴 CRITICAL (Pilares):"
echo "  • express: REST API framework"
echo "  • better-sqlite3: Database with ACID transactions"
echo "  • jsonwebtoken: JWT authentication (Pilar 5.1)"
echo "  • helmet: Security headers (Pilar 5.1)"
echo "  • express-rate-limit: Rate limiting (Pilar 5.1)"
echo "  • winston: Structured logging (Pilar 6.1)"
echo "  • prom-client: Prometheus metrics (Pilar 6.2)"
echo "  • zod: Input validation (Pilar 5.2)"
echo ""
echo "🟡 SECONDARY:"
echo "  • bcryptjs: Password hashing"
echo "  • cors: CORS configuration"
echo "  • qrcode: QR code generation"
echo "  • node-cron: Scheduled tasks"
echo ""
echo "🔧 DEVELOPMENT:"
echo "  • jest: Testing framework (Pilar 2.3)"
echo "  • supertest: HTTP assertion library"
echo "  • eslint: Linting (Pilar 2.1)"
echo "  • prettier: Code formatting (Pilar 2.1)"
echo "  • nodemon: Auto-reload in development"
echo ""

log_info ""
log_warn "To install dependencies, run:"
echo "  cd vouchers-hostal-playa-norte/backend"
echo "  npm install"
echo ""

log_success "package.json ready!"
