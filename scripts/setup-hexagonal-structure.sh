#!/bin/bash

##############################################################################
# SETUP HEXAGONAL STRUCTURE - CONSTITUTIONAL ARCHITECTURE
# Crea la estructura de directorios completa siguiendo la arquitectura
# hexagonal constitucional para el Sistema de Vouchers Digitales
#
# Uso: bash scripts/setup-hexagonal-structure.sh
# Duración: ~30 segundos
# Pilares: 1.1 (Arquitectura Hexagonal), 2.1 (Estándares de Código)
##############################################################################

set -e  # Exit on error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

log_success() {
    echo -e "${GREEN}✅ ${NC}$1"
}

log_warn() {
    echo -e "${YELLOW}⚠️  ${NC}$1"
}

log_error() {
    echo -e "${RED}❌ ${NC}$1"
}

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

log_info "=========================================="
log_info "CONSTITUTIONAL HEXAGONAL SETUP"
log_info "=========================================="
log_info "Project Root: $PROJECT_ROOT"

# Check if vouchers-hostal-playa-norte exists
if [ ! -d "vouchers-hostal-playa-norte" ]; then
    log_error "Directory 'vouchers-hostal-playa-norte' not found"
    exit 1
fi

cd vouchers-hostal-playa-norte

##############################################################################
# BACKEND STRUCTURE
##############################################################################
log_info ""
log_info "Creating BACKEND structure..."

# Domain Layer
mkdir -p backend/src/domain/{entities,value-objects,repositories,events,exceptions}
log_success "Created domain/ (entities, value-objects, repositories, events, exceptions)"

# Application Layer
mkdir -p backend/src/application/{use-cases,commands,queries,handlers,dto,mappers}
log_success "Created application/ (use-cases, commands, queries, handlers, dto, mappers)"

# Infrastructure Layer
mkdir -p backend/src/infrastructure/{persistence,messaging,observability,security,external-apis,config}
log_success "Created infrastructure/ (persistence, messaging, observability, security, external-apis, config)"

# Presentation Layer
mkdir -p backend/src/presentation/{http/{routes,controllers,middleware},cli,utils}
log_success "Created presentation/ (http, cli, utils)"

# Backend tests
mkdir -p backend/tests/{unit,integration,e2e,fixtures}
log_success "Created tests/ (unit, integration, e2e, fixtures)"

# Backend database
mkdir -p backend/db/{migrations,seeds}
log_success "Created db/ (migrations, seeds)"

# Backend logs
mkdir -p backend/logs
log_success "Created logs/"

##############################################################################
# PWA FRONTEND STRUCTURE
##############################################################################
log_info ""
log_info "Creating PWA FRONTEND structure..."

mkdir -p pwa-cafeteria/src/{components/{common,screens,forms},services/{api,storage,sync},workers,utils,hooks,context}
log_success "Created src/ (components, services, workers, utils, hooks, context)"

mkdir -p pwa-cafeteria/public/{icons,manifests}
log_success "Created public/ (icons, manifests)"

mkdir -p pwa-cafeteria/tests/{unit,e2e}
log_success "Created tests/ (unit, e2e)"

##############################################################################
# SHARED STRUCTURE
##############################################################################
log_info ""
log_info "Creating SHARED structure..."

mkdir -p docs/{ADR,api,architecture}
log_success "Created docs/ (ADR, api, architecture)"

mkdir -p scripts
log_success "Created scripts/"

##############################################################################
# CREATE PLACEHOLDER FILES
##############################################################################
log_info ""
log_info "Creating placeholder files..."

# Backend domain
cat > backend/src/domain/entities/.gitkeep << 'EOF'
# Domain Entities
# Example: Voucher.js, Stay.js, Redemption.js
EOF
log_success "Created domain/entities/.gitkeep"

# Backend application
cat > backend/src/application/use-cases/.gitkeep << 'EOF'
# Application Use Cases
# Example: EmitVoucherUseCase.js, RedeemVoucherUseCase.js
EOF
log_success "Created application/use-cases/.gitkeep"

# Backend infrastructure
cat > backend/src/infrastructure/persistence/.gitkeep << 'EOF'
# Infrastructure Persistence Layer
# Implementation: SQLiteVoucherRepository, SQLiteRedemptionRepository
EOF
log_success "Created infrastructure/persistence/.gitkeep"

# Frontend components
cat > pwa-cafeteria/src/components/common/.gitkeep << 'EOF'
# Reusable Components
# Example: Header.jsx, Footer.jsx, Loading.jsx
EOF
log_success "Created components/common/.gitkeep"

# Tests
cat > backend/tests/unit/.gitkeep << 'EOF'
# Unit Tests
# Target: >60-70% coverage
EOF
log_success "Created tests/unit/.gitkeep"

cat > backend/tests/integration/.gitkeep << 'EOF'
# Integration Tests
# Target: >20-30% coverage
# Includes: API tests, Database tests
EOF
log_success "Created tests/integration/.gitkeep"

cat > backend/tests/e2e/.gitkeep << 'EOF'
# End-to-End Tests
# Target: >10-15% coverage
# Includes: Critical user flows
EOF
log_success "Created tests/e2e/.gitkeep"

##############################################################################
# CREATE ARCHITECTURE DOCUMENTATION
##############################################################################
log_info ""
log_info "Creating architecture documentation..."

cat > docs/architecture/DEPENDENCY_RULES.md << 'EOF'
# Dependency Rules - Arquitectura Hexagonal

## Reglas Obligatorias

1. **Domain NO depende de nadie**
   - ✅ Puede importar otros módulos de domain/
   - ❌ NO puede importar application/
   - ❌ NO puede importar infrastructure/
   - ❌ NO puede importar presentation/

2. **Application solo depende de Domain**
   - ✅ Puede importar domain/
   - ✅ Puede importar otros módulos de application/
   - ❌ NO puede importar infrastructure/
   - ❌ NO puede importar presentation/

3. **Infrastructure depende de Application y Domain**
   - ✅ Puede importar domain/
   - ✅ Puede importar application/ (interfaces)
   - ✅ Puede importar otros módulos de infrastructure/
   - ❌ NO puede importar presentation/

4. **Presentation depende de Application**
   - ✅ Puede importar application/
   - ✅ Puede importar domain/
   - ✅ Puede importar otros módulos de presentation/
   - ⚠️ Puede importar infrastructure/ SOLO para configuración

## Violaciones Comunes

❌ PROHIBIDO: `domain/entities/Voucher.js` importa `infrastructure/persistence/VoucherRepository.js`
✅ CORRECTO: `infrastructure/persistence/VoucherRepository.js` implementa interfaz de `domain/repositories/VoucherRepository.js`

❌ PROHIBIDO: `application/handlers/EmitVoucherHandler.js` importa `presentation/http/controllers/VoucherController.js`
✅ CORRECTO: `presentation/http/controllers/VoucherController.js` inyecta `application/handlers/EmitVoucherHandler.js`

## Verificación

Ejecutar:
```bash
npm run lint:dependencies
```

Para automatizar verificación de reglas de dependencia.
EOF
log_success "Created docs/architecture/DEPENDENCY_RULES.md"

cat > docs/ADR/template.md << 'EOF'
# ADR-XXX: [Título de la Decisión Arquitectónica]

## Estado
[Propuesto | Aceptado | Rechazado | Deprecado | Superseded by ADR-YYY]

## Contexto
¿Cuál es el problema que estamos tratando de resolver?
¿Por qué es importante?
¿Qué restricciones tenemos?

## Decisión
¿Qué decidimos hacer y por qué?
¿Cuál fue el criterio de selección?

## Consecuencias
### Positivas
- Beneficio 1
- Beneficio 2
- Impacto a largo plazo positivo

### Negativas
- Costo 1
- Costo 2
- Posibles riesgos

## Alternativas Consideradas
1. Alternativa A
   - Pros: ...
   - Cons: ...
   
2. Alternativa B
   - Pros: ...
   - Cons: ...

## Alineación Constitucional
- **Pilares Afectados:** [1, 2, 5]
- **Cumplimiento:** [✅ Total | ⚠️ Parcial | ❌ Requiere Excepción]
- **Justificación:** [Si hay desviación, explicar por qué]

## Métricas de Éxito
- Métrica 1: [Target]
- Métrica 2: [Target]

## Fecha
YYYY-MM-DD

## Autores
- [@username1](https://github.com/username1)

## Revisores
- [@reviewer1](https://github.com/reviewer1) - [✅ Aprobado | ⏳ Pendiente]
EOF
log_success "Created docs/ADR/template.md"

##############################################################################
# CREATE CONFIGURATION FILES
##############################################################################
log_info ""
log_info "Creating configuration files..."

# .eslintrc.json for backend
cat > backend/.eslintrc.json << 'EOF'
{
  "root": true,
  "env": {
    "node": true,
    "es2021": true,
    "jest": true
  },
  "extends": [
    "eslint:recommended"
  ],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-var": "error",
    "prefer-const": "error",
    "complexity": ["error", 10],
    "max-lines": ["warn", 300],
    "max-lines-per-function": ["warn", 50],
    "semi": ["error", "always"],
    "quotes": ["error", "single"],
    "indent": ["error", 2],
    "comma-dangle": ["error", "never"],
    "trailing-comma": "off"
  }
}
EOF
log_success "Created backend/.eslintrc.json"

# prettier config
cat > .prettierrc.json << 'EOF'
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "none",
  "arrowParens": "always",
  "endOfLine": "lf"
}
EOF
log_success "Created .prettierrc.json"

# jest config
cat > backend/jest.config.js << 'EOF'
module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
EOF
log_success "Created backend/jest.config.js"

##############################################################################
# SUMMARY
##############################################################################
log_info ""
log_info "=========================================="
log_success "HEXAGONAL STRUCTURE CREATED SUCCESSFULLY"
log_info "=========================================="

echo ""
log_info "Directory Structure Created:"
echo ""
tree -L 3 -d --charset ascii 2>/dev/null || find . -type d -not -path '*/\.*' | head -30

echo ""
log_info "Next Steps:"
echo ""
echo "1. Install dependencies:"
echo "   cd backend && npm install"
echo ""
echo "2. Apply CHECKLIST 1: Pre-Development Setup"
echo "   See: CONSTITUCION_SISTEMA_VOUCHERS_PARTE_2.md"
echo ""
echo "3. Begin MÓDULO 0: Preparación del Entorno"
echo "   See: CHECKLIST_EJECUTABLE.md"
echo ""
echo "4. Review architecture rules:"
echo "   cat docs/architecture/DEPENDENCY_RULES.md"
echo ""

log_success "Setup Complete! ✨"
