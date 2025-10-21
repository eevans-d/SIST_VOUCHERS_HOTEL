#!/bin/bash
# MASTER SETUP SCRIPT - MÓDULO 0 + Fase 0 Constitucional
# Ref: CHECKLIST_EJECUTABLE.md + INTEGRACION_CONSTITUCIONAL.md

set -e

echo "🏛️  SETUP CONSTITUCIONAL MAESTRO"
echo "================================"
echo ""

# 1. Estructura hexagonal
echo "📁 Paso 1/5: Creando estructura hexagonal..."
bash scripts/setup-hexagonal-structure.sh
echo ""

# 2. Package.json
echo "📦 Paso 2/5: Generando package.json..."
bash scripts/generate-package-json.sh
echo ""

# 3. Instalar dependencias
echo "📥 Paso 3/5: Instalando dependencias..."
cd vouchers-hostal-playa-norte/backend && npm install && cd ../..
echo ""

# 4. Database schema
echo "🗄️  Paso 4/5: Inicializando base de datos..."
bash scripts/init-database.sh
echo ""

# 5. Verificación
echo "✅ Paso 5/5: Verificando setup..."
if [ -f backend/package.json ] && [ -f backend/db/schema.sql ]; then
  echo "✅ Setup completado exitosamente"
  echo ""
  echo "📋 Próximos pasos:"
  echo "1. Generar secrets: openssl rand -hex 32"
  echo "2. Configurar .env"
  echo "3. Comenzar MÓDULO 1"
else
  echo "❌ Error en setup"
  exit 1
fi
