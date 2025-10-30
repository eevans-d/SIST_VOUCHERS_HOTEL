#!/bin/bash

##
# Pre-deploy Security Checklist
# Valida que todos los secretos y configuración estén listos para producción
##

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

APP_NAME="hpn-vouchers-backend"
ERRORS=0
WARNINGS=0

echo -e "${BLUE}================== PRE-DEPLOY SECURITY CHECK ==================${NC}"
echo ""

# ========== VALIDACIÓN: GIT LIMPIO ==========
echo -e "${BLUE}1. Verificando estado de git...${NC}"
if [ -z "$(git status --porcelain)" ]; then
  echo -e "${GREEN}✅ Git limpio (sin cambios pendientes)${NC}"
else
  echo -e "${YELLOW}⚠️  Cambios pendientes en git. Haz commit antes de deploy.${NC}"
  git status --short
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# ========== VALIDACIÓN: SECRETOS NO HARDCODEADOS ==========
echo -e "${BLUE}2. Buscando secretos hardcodeados en src/...${NC}"
if grep -r "JWT_SECRET\|VOUCHER_SECRET\|JWT_REFRESH_SECRET" src/ --include="*.js" | grep -v 'process.env' || true | grep -q .; then
  echo -e "${RED}❌ ERROR: Secretos hardcodeados encontrados!${NC}"
  grep -r "JWT_SECRET\|VOUCHER_SECRET\|JWT_REFRESH_SECRET" src/ --include="*.js" | grep -v 'process.env' || true
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ No hay secretos hardcodeados${NC}"
fi
echo ""

# ========== VALIDACIÓN: .env.example actualizado ==========
echo -e "${BLUE}3. Verificando .env.example...${NC}"
if [ -f ".env.example" ]; then
  echo -e "${GREEN}✅ .env.example existe${NC}"
  # Validar que tenga variables críticas
  for var in "NODE_ENV" "JWT_SECRET" "VOUCHER_SECRET" "DATABASE_PATH"; do
    if grep -q "$var" .env.example; then
      echo -e "${GREEN}  ✓ $var${NC}"
    else
      echo -e "${RED}  ✗ $var faltante${NC}"
      ERRORS=$((ERRORS + 1))
    fi
  done
else
  echo -e "${RED}❌ .env.example no encontrado${NC}"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# ========== VALIDACIÓN: fly.toml existe y es válido ==========
echo -e "${BLUE}4. Verificando fly.toml...${NC}"
if [ -f "fly.toml" ]; then
  echo -e "${GREEN}✅ fly.toml existe${NC}"
  # Validar que tenga secciones críticas
  if grep -q "\[env\]" fly.toml; then
    echo -e "${GREEN}  ✓ Sección [env] presente${NC}"
  else
    echo -e "${YELLOW}  ⚠️  Sección [env] no encontrada. Se recomienda configurarla.${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
  if grep -q "NODE_ENV" fly.toml; then
    echo -e "${GREEN}  ✓ NODE_ENV configurado${NC}"
  else
    echo -e "${YELLOW}  ⚠️  NODE_ENV no configurado en fly.toml${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "${RED}❌ fly.toml no encontrado${NC}"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# ========== VALIDACIÓN: Dockerfile ==========
echo -e "${BLUE}5. Verificando Dockerfile...${NC}"
if [ -f "Dockerfile" ]; then
  echo -e "${GREEN}✅ Dockerfile existe${NC}"
  # Validar base image
  if grep -q "node:18-bookworm-slim\|node:18" Dockerfile; then
    echo -e "${GREEN}  ✓ Base image soportada${NC}"
  else
    echo -e "${YELLOW}  ⚠️  Base image podría ser incompatible${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
  # Validar tini
  if grep -q "tini\|entrypoint" Dockerfile; then
    echo -e "${GREEN}  ✓ Tini configurado para signal handling${NC}"
  else
    echo -e "${YELLOW}  ⚠️  Tini no configurado. Se recomienda para graceful shutdown.${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "${RED}❌ Dockerfile no encontrado${NC}"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# ========== VALIDACIÓN: Tests ==========
echo -e "${BLUE}6. Ejecutando tests...${NC}"
if command -v npm &> /dev/null; then
  if npm test 2>&1 | tail -5; then
    echo -e "${GREEN}✅ Tests pasaron${NC}"
  else
    echo -e "${RED}❌ Tests fallaron. Soluciona antes de deploy.${NC}"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo -e "${YELLOW}⚠️  npm no encontrado. Salta validación de tests.${NC}"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# ========== VALIDACIÓN: Build local ==========
echo -e "${BLUE}7. Verificando build local...${NC}"
if [ -d "dist" ] || [ -d "build" ]; then
  echo -e "${GREEN}✅ Artefactos de build encontrados${NC}"
elif npm run build &>/dev/null 2>&1; then
  echo -e "${GREEN}✅ Build local OK${NC}"
else
  echo -e "${YELLOW}⚠️  Build local no probado. Puede fallar en Fly.${NC}"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# ========== VALIDACIÓN: CORES SECRETOS EN FLY.IO ==========
echo -e "${BLUE}8. Verificando secretos en Fly.io...${NC}"
if command -v flyctl &> /dev/null; then
  SECRETS=$(flyctl secrets list -a "$APP_NAME" 2>/dev/null || echo "")
  if echo "$SECRETS" | grep -q "JWT_SECRET"; then
    echo -e "${GREEN}✅ JWT_SECRET está en Fly.io${NC}"
  else
    echo -e "${YELLOW}⚠️  JWT_SECRET no encontrado en Fly.io. Úsalo: flyctl secrets set JWT_SECRET=\"...\"${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
  if echo "$SECRETS" | grep -q "VOUCHER_SECRET"; then
    echo -e "${GREEN}✅ VOUCHER_SECRET está en Fly.io${NC}"
  else
    echo -e "${YELLOW}⚠️  VOUCHER_SECRET no encontrado en Fly.io${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "${YELLOW}⚠️  flyctl no está instalado. Salta validación de Fly.io.${NC}"
fi
echo ""

# ========== RESUMEN FINAL ==========
echo -e "${BLUE}========== RESUMEN FINAL ==========${NC}"
if [ "$ERRORS" -eq 0 ]; then
  if [ "$WARNINGS" -eq 0 ]; then
    echo -e "${GREEN}🎉 TODO OK - Lista para deploy a producción${NC}"
    exit 0
  else
    echo -e "${YELLOW}⚠️  $WARNINGS advertencias encontradas (revisar arriba)${NC}"
    echo -e "${YELLOW}Puedes proceder, pero revisa las advertencias.${NC}"
    exit 0
  fi
else
  echo -e "${RED}❌ $ERRORS errores encontrados. Soluciona antes de deploy.${NC}"
  exit 1
fi
