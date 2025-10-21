#!/bin/bash

##############################################################################
# MASTER SETUP ORCHESTRATOR - MÓDULO 0
# Ejecuta todos los pasos de preparación del entorno de forma automática
#
# Uso: bash scripts/setup-all.sh
# Duración: ~5-10 minutos
# Pilares: TODOS (Arquitectura, Código, Seguridad, Logging, etc)
##############################################################################

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ ${NC}$1"; }
log_success() { echo -e "${GREEN}✅ ${NC}$1"; }
log_warn() { echo -e "${YELLOW}⚠️  ${NC}$1"; }
log_error() { echo -e "${RED}❌ ${NC}$1"; }
log_section() { echo -e "\n${CYAN}╔════════════════════════════════════════════════════════╗${NC}"; echo -e "${CYAN}║ $1${NC}"; echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}\n"; }

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log_section "CONSTITUTIONAL PROJECT SETUP - MÓDULO 0"

##############################################################################
# PRE-FLIGHT CHECKS
##############################################################################

log_info "Phase 1/5: Pre-flight Checks"

# Check Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js not installed"
    exit 1
fi

NODE_VERSION=$(node -v)
log_success "Node.js $NODE_VERSION ✓"

# Check npm
if ! command -v npm &> /dev/null; then
    log_error "npm not installed"
    exit 1
fi

NPM_VERSION=$(npm -v)
log_success "npm $NPM_VERSION ✓"

# Check bash
log_success "Bash available ✓"

# Check project structure
if [ ! -d "$PROJECT_ROOT" ]; then
    log_error "Project root not found: $PROJECT_ROOT"
    exit 1
fi

log_success "Project root verified ✓"

##############################################################################
# STEP 1: CREATE DIRECTORY STRUCTURE
##############################################################################

log_section "Step 1/4: Creating Hexagonal Architecture"

if [ -f "$PROJECT_ROOT/scripts/setup-hexagonal-structure.sh" ]; then
    bash "$PROJECT_ROOT/scripts/setup-hexagonal-structure.sh"
    log_success "Hexagonal structure created"
else
    log_error "setup-hexagonal-structure.sh not found"
    exit 1
fi

##############################################################################
# STEP 2: CREATE CONFIGURATION FILES
##############################################################################

log_section "Step 2/4: Setting Up Configuration"

if [ -f "$PROJECT_ROOT/scripts/setup-config.sh" ]; then
    bash "$PROJECT_ROOT/scripts/setup-config.sh"
    log_success "Configuration setup completed"
else
    log_error "setup-config.sh not found"
    exit 1
fi

##############################################################################
# STEP 3: INSTALL DEPENDENCIES
##############################################################################

log_section "Step 3/4: Installing Dependencies"

BACKEND_DIR="$PROJECT_ROOT/vouchers-hostal-playa-norte/backend"

if [ -f "$PROJECT_ROOT/scripts/setup-dependencies.sh" ]; then
    bash "$PROJECT_ROOT/scripts/setup-dependencies.sh"
    
    log_info "Installing npm packages..."
    cd "$BACKEND_DIR" || exit 1
    
    if npm install 2>&1 | tail -5; then
        log_success "npm packages installed"
    else
        log_error "npm install failed"
        exit 1
    fi
    
    cd "$PROJECT_ROOT" || exit 1
else
    log_error "setup-dependencies.sh not found"
    exit 1
fi

##############################################################################
# STEP 4: CREATE DATABASE SCHEMA
##############################################################################

log_section "Step 4/4: Initializing Database"

if [ -f "$PROJECT_ROOT/scripts/setup-database.sh" ]; then
    bash "$PROJECT_ROOT/scripts/setup-database.sh"
    log_success "Database schema created"
else
    log_error "setup-database.sh not found"
    exit 1
fi

##############################################################################
# POST-SETUP VERIFICATION
##############################################################################

log_section "VERIFICATION PHASE"

log_info "Checking created structure..."

CHECKS=(
    "vouchers-hostal-playa-norte/backend/src/domain:domain layer"
    "vouchers-hostal-playa-norte/backend/src/application:application layer"
    "vouchers-hostal-playa-norte/backend/src/infrastructure:infrastructure layer"
    "vouchers-hostal-playa-norte/backend/src/presentation:presentation layer"
    "vouchers-hostal-playa-norte/backend/tests:tests directory"
    "vouchers-hostal-playa-norte/backend/.env:environment file"
    "vouchers-hostal-playa-norte/backend/package.json:package.json"
    "vouchers-hostal-playa-norte/backend/.eslintrc.json:ESLint config"
    "vouchers-hostal-playa-norte/backend/.prettierrc.json:Prettier config"
    "vouchers-hostal-playa-norte/backend/jest.config.js:Jest config"
    "vouchers-hostal-playa-norte/pwa-cafeteria/src:PWA structure"
    "docs/architecture/DEPENDENCY_RULES.md:Dependency rules"
)

TOTAL_CHECKS=${#CHECKS[@]}
PASSED_CHECKS=0

for check in "${CHECKS[@]}"; do
    IFS=':' read -r path name <<< "$check"
    if [ -e "$PROJECT_ROOT/$path" ]; then
        echo "  ✅ $name"
        ((PASSED_CHECKS++))
    else
        echo "  ❌ $name (missing: $path)"
    fi
done

log_info ""
log_success "$PASSED_CHECKS/$TOTAL_CHECKS checks passed"

##############################################################################
# FINAL STATUS
##############################################################################

log_section "MÓDULO 0 SETUP COMPLETE! ✨"

echo ""
log_success "Constitutional Project Initialized"
echo ""

log_info "📊 Setup Summary:"
echo "  • Hexagonal Architecture: Created"
echo "  • Configuration Files: Generated"
echo "  • Dependencies: Installed"
echo "  • Database Schema: Initialized"
echo ""

log_warn "🔐 IMPORTANT - Next Manual Steps:"
echo ""
echo "1. Generate and set secrets:"
echo "   bash scripts/generate-secrets.sh"
echo "   # Copy output to vouchers-hostal-playa-norte/backend/.env"
echo ""
echo "2. Initialize database:"
echo "   cd vouchers-hostal-playa-norte/backend"
echo "   npm run db:migrate"
echo ""
echo "3. Verify logs directory:"
echo "   mkdir -p logs"
echo ""
echo "4. Run pre-commit checks:"
echo "   npm run lint"
echo "   npm run test:unit"
echo ""
echo "5. Start development server:"
echo "   npm run dev"
echo ""

log_info "📚 Documentation:"
echo "  • Read: docs/README_CONSTITUCIONAL.md"
echo "  • Review: CHECKLIST 1 in CONSTITUCION_SISTEMA_VOUCHERS_PARTE_2.md"
echo "  • Architecture Rules: docs/architecture/DEPENDENCY_RULES.md"
echo ""

log_success "Your constitutional project is ready! 🚀"
echo ""
