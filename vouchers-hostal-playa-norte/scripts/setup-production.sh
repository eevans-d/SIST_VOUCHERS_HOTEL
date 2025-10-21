#!/bin/bash

set -e

echo "🏗️  Setup de Producción - Hostal Playa Norte"
echo "============================================="
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Verificar requisitos
echo -e "${YELLOW}1. Verificando requisitos...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js no está instalado${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm no está instalado${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker no está instalado (opcional)${NC}"
fi

echo -e "${GREEN}✓ Requisitos verificados${NC}"
echo ""

# 2. Instalar dependencias backend
echo -e "${YELLOW}2. Instalando dependencias backend...${NC}"
cd backend
npm ci --only=production
echo -e "${GREEN}✓ Dependencias backend instaladas${NC}"
echo ""

# 3. Configurar base de datos
echo -e "${YELLOW}3. Configurando base de datos...${NC}"
node scripts/setup-db.js
echo -e "${GREEN}✓ Base de datos configurada${NC}"
echo ""

# 4. Generar secretos
echo -e "${YELLOW}4. Generando secretos...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    
    VOUCHER_SECRET=$(openssl rand -hex 32)
    JWT_SECRET=$(openssl rand -hex 32)
    
    sed -i "s/your-32-byte-random-hex-here-change-in-production/$VOUCHER_SECRET/" .env
    sed -i "s/your-32-byte-random-hex-here-change-in-production/$JWT_SECRET/" .env
    
    echo -e "${GREEN}✓ Archivo .env creado con secretos${NC}"
    echo -e "${YELLOW}⚠️  IMPORTANTE: Revisa y actualiza el archivo .env${NC}"
else
    echo -e "${YELLOW}⚠️  Archivo .env ya existe, saltando...${NC}"
fi
echo ""

# 5. Ejecutar tests
echo -e "${YELLOW}5. Ejecutando tests...${NC}"
npm test
echo -e "${GREEN}✓ Tests completados${NC}"
echo ""

# 6. Build PWA
echo -e "${YELLOW}6. Building PWA...${NC}"
cd ../pwa-cafeteria
npm ci
npm run build
echo -e "${GREEN}✓ PWA construida${NC}"
echo ""

cd ..

# 7. Resumen
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Setup de Producción Completado                   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Próximos pasos:"
echo "  1. Revisar y actualizar backend/.env"
echo "  2. Configurar dominio y SSL"
echo "  3. Ejecutar: npm start (backend)"
echo "  4. Servir PWA desde: pwa-cafeteria/dist"
echo ""
echo "Para deploy a Fly.io:"
echo "  ./scripts/deploy-fly.sh"
echo ""