#!/bin/bash
# Script: Generar package.json con dependencias constitucionales
# Ref: PLANIFICACION_MAESTRA_DESARROLLO.md - MÓDULO 0

set -e

echo "📦 Generando package.json..."

cd vouchers-hostal-playa-norte/backend

cat > package.json << 'EOF'
{
  "name": "voucher-system-backend",
  "version": "1.0.0",
  "description": "Sistema de Vouchers Digitales - Backend Constitucional",
  "main": "src/index.js",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "NODE_ENV=test jest --coverage",
    "test:unit": "NODE_ENV=test jest tests/unit --coverage",
    "test:integration": "NODE_ENV=test jest tests/integration",
    "test:e2e": "NODE_ENV=test playwright test",
    "test:coverage": "NODE_ENV=test jest --coverage --coverageThreshold='{\"global\":{\"lines\":80,\"branches\":80,\"functions\":80,\"statements\":80}}'",
    "lint": "eslint src/ --ext .js",
    "format": "prettier --write \"src/**/*.js\"",
    "db:migrate": "node scripts/migrate.js",
    "db:seed": "node scripts/seed.js"
  },
  "dependencies": {
    "better-sqlite3": "^9.2.0",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.5",
    "winston": "^3.11.0",
    "zod": "^3.22.4",
    "qrcode": "^1.5.3",
    "uuid": "^9.0.1",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "@playwright/test": "^1.40.1",
    "nodemon": "^3.0.2",
    "eslint": "^8.56.0",
    "prettier": "^3.1.1",
    "husky": "^8.0.3"
  }
}
EOF

echo "✅ package.json generado"
cat package.json
