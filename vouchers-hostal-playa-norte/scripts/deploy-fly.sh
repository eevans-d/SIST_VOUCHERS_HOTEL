#!/bin/bash

set -e

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🚀 Deploy a Fly.io - Hostal Playa Norte            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar Fly CLI instalado
if ! command -v fly &> /dev/null; then
    echo -e "${RED}❌ Error: Fly CLI no está instalado${NC}"
    echo "Instalar con: curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Verificar login
if ! fly auth whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  No estás autenticado en Fly.io${NC}"
    echo "Ejecutando fly auth login..."
    fly auth login
fi

echo -e "${GREEN}✓ Fly CLI configurado correctamente${NC}"
echo ""

# Directorio del proyecto
cd "$(dirname "$0")/.."

# Verificar si la app existe
APP_NAME="hostal-vouchers-backend"
if ! fly apps list | grep -q "$APP_NAME"; then
    echo -e "${YELLOW}📦 Creando nueva app: $APP_NAME${NC}"
    
    # Crear app
    fly apps create "$APP_NAME" --org personal
    
    # Crear volumen
    echo -e "${YELLOW}💾 Creando volumen persistente...${NC}"
    fly volumes create vouchers_data --size 1 --region gru --app "$APP_NAME"
    
    echo -e "${GREEN}✓ App creada exitosamente${NC}"
else
    echo -e "${GREEN}✓ App $APP_NAME ya existe${NC}"
fi

echo ""

# Configurar secretos
echo -e "${YELLOW}🔐 Configurando secretos...${NC}"

# Verificar si ya existen
if ! fly secrets list --app "$APP_NAME" | grep -q "VOUCHER_SECRET"; then
    echo "Generando VOUCHER_SECRET..."
    VOUCHER_SECRET=$(openssl rand -hex 32)
    fly secrets set VOUCHER_SECRET="$VOUCHER_SECRET" --app "$APP_NAME"
fi

if ! fly secrets list --app "$APP_NAME" | grep -q "JWT_SECRET"; then
    echo "Generando JWT_SECRET..."
    JWT_SECRET=$(openssl rand -hex 32)
    fly secrets set JWT_SECRET="$JWT_SECRET" --app "$APP_NAME"
fi

# Configurar otros secretos
fly secrets set \
  DATABASE_PATH="/data/vouchers.db" \
  ALLOWED_ORIGINS="https://pwa.hostalplayanorte.com,https://cafeteria.hostalplayanorte.com" \
  JWT_EXPIRATION="24h" \
  --app "$APP_NAME"

echo -e "${GREEN}✓ Secretos configurados${NC}"
echo ""

# Ejecutar tests antes de deploy
echo -e "${YELLOW}🧪 Ejecutando tests...${NC}"
cd backend
npm test
cd ..
echo -e "${GREEN}✓ Tests pasaron exitosamente${NC}"
echo ""

# Deploy
echo -e "${YELLOW}🚀 Desplegando a Fly.io...${NC}"
cd backend
fly deploy --app "$APP_NAME"
cd ..

echo ""
echo -e "${GREEN}✅ Deploy completado exitosamente!${NC}"
echo ""

# Mostrar información
echo -e "${BLUE}📊 Información del deployment:${NC}"
fly status --app "$APP_NAME"

echo ""
echo -e "${BLUE}🔗 URLs:${NC}"
echo "   API: https://$APP_NAME.fly.dev"
echo "   Health: https://$APP_NAME.fly.dev/health"
echo ""

# Mostrar logs
echo -e "${YELLOW}📜 Últimos logs (Ctrl+C para salir):${NC}"
fly logs --app "$APP_NAME"
