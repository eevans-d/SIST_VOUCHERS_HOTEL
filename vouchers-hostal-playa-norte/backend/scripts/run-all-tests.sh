#!/bin/bash

set -e

echo "🧪 Ejecutando Suite Completa de Tests"
echo "======================================"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Tests unitarios
echo -e "${YELLOW}📋 Tests Unitarios...${NC}"
npm run test:unit

echo ""

# Tests de integración
echo -e "${YELLOW}📋 Tests de Integración...${NC}"
npm run test:integration

echo ""

# Test Case #10 específico
echo -e "${YELLOW}📋 Test Case #10 (Reconciliación CSV)...${NC}"
npm run test:case10

echo ""

# Reporte de cobertura
echo -e "${GREEN}✅ Todos los tests completados${NC}"
echo ""
echo "📊 Reporte de cobertura disponible en: coverage/lcov-report/index.html"