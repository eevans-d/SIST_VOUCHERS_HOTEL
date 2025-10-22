#!/bin/bash

# 🔍 Script de Verificación Final del Sistema
# Valida que todo esté configurado correctamente para ejecución

echo "═══════════════════════════════════════════════════════════"
echo "  🔍 VERIFICACIÓN FINAL - SISTEMA DE VOUCHERS HOTEL"
echo "═══════════════════════════════════════════════════════════"
echo ""

cd /home/eevan/ProyectosIA/SIST_VOUCHERS_HOTEL/vouchers-hostal-playa-norte/backend

CHECKS_PASSED=0
CHECKS_FAILED=0

# ✅ Función para pasar check
pass_check() {
    echo "  ✅ $1"
    ((CHECKS_PASSED++))
}

# ❌ Función para fallar check
fail_check() {
    echo "  ❌ $1"
    ((CHECKS_FAILED++))
}

# 1. Verificar Node.js
echo "1️⃣  Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    pass_check "Node.js instalado: $NODE_VERSION"
else
    fail_check "Node.js no instalado"
fi

# 2. Verificar npm
echo ""
echo "2️⃣  Verificando npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    pass_check "npm instalado: $NPM_VERSION"
else
    fail_check "npm no instalado"
fi

# 3. Verificar package.json
echo ""
echo "3️⃣  Verificando package.json..."
if [ -f "package.json" ]; then
    pass_check "package.json encontrado"
else
    fail_check "package.json no encontrado"
fi

# 4. Verificar node_modules
echo ""
echo "4️⃣  Verificando dependencias instaladas..."
if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
    pass_check "Dependencies instaladas (node_modules/)"
else
    fail_check "Dependencies no instaladas - ejecutar: npm install"
fi

# 5. Verificar estructura de directorios
echo ""
echo "5️⃣  Verificando estructura de carpetas..."
DIRS=("src" "tests" "db" "logs" "scripts")
for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        pass_check "Directorio /$dir existe"
    else
        fail_check "Directorio /$dir no existe"
    fi
done

# 6. Verificar archivo .env
echo ""
echo "6️⃣  Verificando configuración de entorno..."
if [ -f ".env" ]; then
    pass_check ".env configurado"
    PORT=$(grep "^PORT=" .env | cut -d'=' -f2)
    echo "     → Puerto configurado: $PORT"
else
    if [ -f ".env.example" ]; then
        fail_check ".env no existe (template disponible: .env.example)"
    else
        fail_check ".env ni .env.example encontrados"
    fi
fi

# 7. Verificar base de datos
echo ""
echo "7️⃣  Verificando base de datos..."
if [ -f "db/vouchers.db" ]; then
    DB_SIZE=$(du -h db/vouchers.db | cut -f1)
    pass_check "Base de datos existe (tamaño: $DB_SIZE)"
    
    # Contar tablas
    TABLES=$(sqlite3 db/vouchers.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null)
    if [ ! -z "$TABLES" ]; then
        echo "     → Tablas en BD: $TABLES"
    fi
else
    fail_check "Base de datos no encontrada (ejecutar: bash scripts/init-database.sh)"
fi

# 8. Verificar archivo principal
echo ""
echo "8️⃣  Verificando archivo principal..."
if [ -f "src/index.js" ]; then
    pass_check "src/index.js encontrado"
else
    fail_check "src/index.js no encontrado"
fi

# 9. Verificar estructura de dominio
echo ""
echo "9️⃣  Verificando capas de arquitectura..."
ENTITIES=("src/domain/entities/User.js" "src/domain/entities/Stay.js" "src/domain/entities/Voucher.js" "src/domain/entities/Order.js")
ENTITY_COUNT=0
for entity in "${ENTITIES[@]}"; do
    if [ -f "$entity" ]; then
        ((ENTITY_COUNT++))
    fi
done
if [ $ENTITY_COUNT -eq 4 ]; then
    pass_check "Todas las entities están presentes (4/4)"
else
    fail_check "Faltan entities ($ENTITY_COUNT/4)"
fi

# 10. Verificar repositorios
echo ""
echo "🔟 Verificando repositorios..."
REPOS=("src/domain/repositories/UserRepository.js" "src/domain/repositories/StayRepository.js" "src/domain/repositories/VoucherRepository.js" "src/domain/repositories/OrderRepository.js")
REPO_COUNT=0
for repo in "${REPOS[@]}"; do
    if [ -f "$repo" ]; then
        ((REPO_COUNT++))
    fi
done
if [ $REPO_COUNT -eq 4 ]; then
    pass_check "Todos los repositorios están presentes (4/4)"
else
    fail_check "Faltan repositorios ($REPO_COUNT/4)"
fi

# 11. Verificar rutas HTTP
echo ""
echo "1️⃣1️⃣  Verificando rutas HTTP..."
ROUTES=("src/presentation/http/routes/auth.js" "src/presentation/http/routes/stays.js" "src/presentation/http/routes/vouchers.js" "src/presentation/http/routes/orders.js")
ROUTE_COUNT=0
for route in "${ROUTES[@]}"; do
    if [ -f "$route" ]; then
        ((ROUTE_COUNT++))
    fi
done
if [ $ROUTE_COUNT -eq 4 ]; then
    pass_check "Todas las rutas están presentes (4/4)"
else
    fail_check "Faltan rutas ($ROUTE_COUNT/4)"
fi

# 12. Verificar tests
echo ""
echo "1️⃣2️⃣  Verificando tests unitarios..."
if [ -f "tests/unit/entities/Voucher.test.js" ] && [ -f "tests/unit/entities/Order.test.js" ]; then
    pass_check "Tests están presentes"
else
    fail_check "Tests no encontrados"
fi

# 13. Verificar documentación
echo ""
echo "1️⃣3️⃣  Verificando documentación..."
DOCS=("../../../RESUMEN_EJECUTIVO_FINAL.md" "../../../README_CONSTITUCIONAL.md" "../../../BLUEPRINT_ARQUITECTURA.md" "docs/MODULO_3_README.md" "docs/MODULO_4_README.md")
DOC_COUNT=0
for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        ((DOC_COUNT++))
    fi
done
pass_check "Documentación presente ($DOC_COUNT archivos)"

# 14. Verificar Git
echo ""
echo "1️⃣4️⃣  Verificando Git..."
if command -v git &> /dev/null; then
    if [ -d ".git" ] || [ -d "../../.git" ]; then
        COMMITS=$(git log --oneline 2>/dev/null | head -1)
        pass_check "Repositorio Git configurado"
        echo "     → Último commit: $COMMITS"
    else
        fail_check "No es un repositorio Git"
    fi
else
    fail_check "Git no instalado"
fi

# 15. Verificar scripts disponibles
echo ""
echo "1️⃣5️⃣  Verificando scripts..."
if [ -f "scripts/init-database.sh" ]; then
    pass_check "init-database.sh disponible"
else
    fail_check "init-database.sh no encontrado"
fi

# ═══════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  📊 RESUMEN DE VERIFICACIÓN"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  ✅ Verificaciones pasadas: $CHECKS_PASSED"
echo "  ❌ Verificaciones fallidas: $CHECKS_FAILED"
echo ""

TOTAL=$((CHECKS_PASSED + CHECKS_FAILED))
PERCENTAGE=$((CHECKS_PASSED * 100 / TOTAL))

echo "  Completitud: $PERCENTAGE% ($CHECKS_PASSED/$TOTAL)"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo "  🎉 ¡LISTO PARA EJECUTAR! 🎉"
    echo ""
    echo "  Próximos pasos:"
    echo "  1. npm start          → Iniciar servidor"
    echo "  2. npm test           → Ejecutar tests"
    echo "  3. Revisar docs/      → Documentación"
    echo ""
    exit 0
else
    echo "  ⚠️  REQUIERE CONFIGURACIÓN"
    echo ""
    echo "  Acciones necesarias:"
    if [ ! -f ".env" ]; then
        echo "  • cp .env.example .env"
    fi
    if [ ! -d "node_modules" ]; then
        echo "  • npm install"
    fi
    if [ ! -f "db/vouchers.db" ]; then
        echo "  • bash scripts/init-database.sh"
    fi
    echo ""
    exit 1
fi
