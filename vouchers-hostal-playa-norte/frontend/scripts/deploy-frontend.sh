#!/usr/bin/env bash
# Script de despliegue para frontend en Fly.io
# Uso: ./scripts/deploy-frontend.sh [staging|production]

set -euo pipefail

ENV=${1:-production}
APP_NAME="hpn-vouchers-frontend"

echo "==> Desplegando frontend a $ENV"

# Validar que flyctl esté instalado
if ! command -v flyctl &> /dev/null; then
    echo "❌ flyctl no está instalado. Instalar: curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Validar autenticación
if ! flyctl auth whoami &> /dev/null; then
    echo "❌ No estás autenticado en Fly.io. Ejecutar: flyctl auth login"
    exit 1
fi

# Build local para validar antes de deploy
echo "==> Validando build..."
npm run build

echo "==> Desplegando a Fly.io..."
flyctl deploy --remote-only -a "$APP_NAME"

echo "==> Verificando despliegue..."
flyctl status -a "$APP_NAME"

echo ""
echo "✅ Deploy completado!"
echo "🌐 URL: https://${APP_NAME}.fly.dev"
echo ""
echo "Siguiente paso: Actualizar CORS_ORIGIN en backend:"
echo "  flyctl secrets set CORS_ORIGIN=\"https://hpn-vouchers-backend.fly.dev,https://${APP_NAME}.fly.dev\" -a hpn-vouchers-backend"
