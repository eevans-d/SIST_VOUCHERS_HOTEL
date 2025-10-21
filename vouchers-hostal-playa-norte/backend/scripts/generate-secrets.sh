#!/bin/bash

# Script para generar secretos seguros
# Uso: ./generate-secrets.sh

set -e

echo "🔐 Generando secretos seguros...\n"

VOUCHER_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

echo "# Secretos generados - $(date)"
echo "# ⚠️  NUNCA commitear estos valores a git"
echo ""
echo "VOUCHER_SECRET=$VOUCHER_SECRET"
echo "JWT_SECRET=$JWT_SECRET"
echo ""
echo "✅ Secretos generados exitosamente"
echo "💡 Copia estos valores a tu archivo .env"
