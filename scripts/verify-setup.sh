#!/bin/bash

##############################################################################
# POST-SETUP VERIFICATION SCRIPT
# Verifica que todos los componentes constitucionales están en su lugar
#
# Uso: bash scripts/verify-setup.sh
# Duración: ~30 segundos
# Pilares: Todos (verificación cruzada)
##############################################################################

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0

log_pass() { echo -e "${GREEN}✅ PASS${NC} - $1"; ((PASSED++)); }
log_fail() { echo -e "${RED}❌ FAIL${NC} - $1"; ((FAILED++)); }
log_warn() { echo -e "${YELLOW}⚠️  WARN${NC} - $1"; ((WARNINGS++)); }
log_info() { echo -e "${BLUE}ℹ INFO${NC} - $1"; }

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/vouchers-hostal-playa-norte/backend"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        CONSTITUTIONAL SETUP VERIFICATION                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

##############################################################################
# SECTION 1: ENVIRONMENT & TOOLS
##############################################################################
echo "📋 SECTION 1: Environment & Tools"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Node.js
if command -v node &> /dev/null; then
    NODE_V=$(node -v)
    if [[ "$NODE_V" =~ ^v(1[8-9]|[2-9][0-9]) ]]; then
        log_pass "Node.js installed ($NODE_V)"
    else
        log_fail "Node.js version too old ($NODE_V, need >=18)"
    fi
else
    log_fail "Node.js not installed"
fi

# npm
if command -v npm &> /dev/null; then
    NPM_V=$(npm -v)
    log_pass "npm installed ($NPM_V)"
else
    log_fail "npm not installed"
fi

# git
if command -v git &> /dev/null; then
    log_pass "git installed"
else
    log_fail "git not installed"
fi

# SQLite
if command -v sqlite3 &> /dev/null; then
    log_pass "sqlite3 CLI installed"
else
    log_warn "sqlite3 CLI not installed (optional, Node.js has driver)"
fi

echo ""

##############################################################################
# SECTION 2: PROJECT STRUCTURE
##############################################################################
echo "📋 SECTION 2: Project Structure"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backend layers (Hexagonal)
LAYERS=(
    "src/domain"
    "src/domain/entities"
    "src/domain/repositories"
    "src/domain/events"
    "src/domain/exceptions"
    "src/application"
    "src/application/use-cases"
    "src/application/handlers"
    "src/application/dto"
    "src/infrastructure"
    "src/infrastructure/persistence"
    "src/infrastructure/config"
    "src/infrastructure/security"
    "src/infrastructure/observability"
    "src/presentation"
    "src/presentation/http"
)

for layer in "${LAYERS[@]}"; do
    if [ -d "$BACKEND_DIR/$layer" ]; then
        log_pass "Layer: $layer"
    else
        log_fail "Layer: $layer (MISSING)"
    fi
done

# Test structure
if [ -d "$BACKEND_DIR/tests" ]; then
    log_pass "Test directory exists"
    if [ -d "$BACKEND_DIR/tests/unit" ]; then
        log_pass "Unit tests directory"
    else
        log_warn "Unit tests directory missing"
    fi
    if [ -d "$BACKEND_DIR/tests/integration" ]; then
        log_pass "Integration tests directory"
    else
        log_warn "Integration tests directory missing"
    fi
else
    log_fail "Test directory missing"
fi

# Database
if [ -d "$BACKEND_DIR/db" ]; then
    log_pass "Database directory exists"
    if [ -d "$BACKEND_DIR/db/migrations" ]; then
        log_pass "Migrations directory"
    else
        log_fail "Migrations directory missing"
    fi
else
    log_fail "Database directory missing"
fi

# Docs
if [ -d "$PROJECT_ROOT/docs" ]; then
    log_pass "Docs directory exists"
else
    log_fail "Docs directory missing"
fi

echo ""

##############################################################################
# SECTION 3: CONFIGURATION FILES
##############################################################################
echo "📋 SECTION 3: Configuration Files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CONFIG_FILES=(
    "$BACKEND_DIR/.env.example"
    "$BACKEND_DIR/.env"
    "$BACKEND_DIR/.env.production"
    "$BACKEND_DIR/.eslintrc.json"
    "$BACKEND_DIR/.prettierrc.json"
    "$BACKEND_DIR/jest.config.js"
    "$BACKEND_DIR/package.json"
    "$PROJECT_ROOT/docs/architecture/DEPENDENCY_RULES.md"
    "$PROJECT_ROOT/docs/ADR/template.md"
)

for file in "${CONFIG_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_pass "File: $(basename $file)"
    else
        log_fail "File: $(basename $file) (MISSING)"
    fi
done

echo ""

##############################################################################
# SECTION 4: NPM DEPENDENCIES
##############################################################################
echo "📋 SECTION 4: NPM Dependencies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "$BACKEND_DIR/package.json" ]; then
    log_pass "package.json exists"
    
    if [ -d "$BACKEND_DIR/node_modules" ]; then
        log_pass "node_modules installed"
        
        # Check critical dependencies
        DEPS=("express" "better-sqlite3" "jsonwebtoken" "helmet" "winston" "zod")
        for dep in "${DEPS[@]}"; do
            if [ -d "$BACKEND_DIR/node_modules/$dep" ]; then
                log_pass "Dependency: $dep"
            else
                log_fail "Dependency: $dep (NOT INSTALLED)"
            fi
        done
    else
        log_fail "node_modules not installed - run 'npm install'"
    fi
    
    # Check npm scripts
    SCRIPTS=("start" "dev" "lint" "test" "db:migrate")
    for script in "${SCRIPTS[@]}"; do
        if grep -q "\"$script\":" "$BACKEND_DIR/package.json"; then
            log_pass "npm script: $script"
        else
            log_fail "npm script: $script (MISSING)"
        fi
    done
else
    log_fail "package.json not found"
fi

echo ""

##############################################################################
# SECTION 5: CONFIGURATION INTEGRITY
##############################################################################
echo "📋 SECTION 5: Configuration Integrity"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# .env variables
if [ -f "$BACKEND_DIR/.env" ]; then
    # Check key variables
    VARS=("NODE_ENV" "PORT" "DATABASE_PATH" "LOG_LEVEL")
    for var in "${VARS[@]}"; do
        if grep -q "^$var=" "$BACKEND_DIR/.env"; then
            log_pass ".env variable: $var"
        else
            log_warn ".env variable: $var (NOT SET)"
        fi
    done
    
    # Check secrets are not hardcoded with CHANGE_ME
    if grep -q "CHANGE_ME_IN_ENV" "$BACKEND_DIR/.env"; then
        log_warn "Secrets still contain placeholders (needs update)"
    else
        log_pass "Secrets placeholders replaced"
    fi
else
    log_fail ".env file not found"
fi

# ESLint config
if [ -f "$BACKEND_DIR/.eslintrc.json" ]; then
    if jq . "$BACKEND_DIR/.eslintrc.json" &> /dev/null; then
        log_pass "ESLint config is valid JSON"
    else
        log_fail "ESLint config JSON is invalid"
    fi
else
    log_fail "ESLint config missing"
fi

# Jest config
if [ -f "$BACKEND_DIR/jest.config.js" ]; then
    if grep -q "collectCoverageFrom" "$BACKEND_DIR/jest.config.js"; then
        log_pass "Jest coverage configured"
    else
        log_warn "Jest coverage not configured"
    fi
else
    log_fail "Jest config missing"
fi

echo ""

##############################################################################
# SECTION 6: DATABASE
##############################################################################
echo "📋 SECTION 6: Database"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SCHEMA_FILE="$BACKEND_DIR/src/infrastructure/persistence/migrations/001-initial-schema.sql"
if [ -f "$SCHEMA_FILE" ]; then
    log_pass "Initial schema file exists"
    
    # Check for key tables
    TABLES=("users" "vouchers" "redemption_logs" "sync_logs" "business_metrics")
    for table in "${TABLES[@]}"; do
        if grep -q "CREATE TABLE.*$table" "$SCHEMA_FILE"; then
            log_pass "Schema table: $table"
        else
            log_fail "Schema table: $table (NOT DEFINED)"
        fi
    done
else
    log_fail "Initial schema missing"
fi

# Check if database file exists
if [ -f "$BACKEND_DIR/vouchers.sqlite" ]; then
    log_pass "SQLite database file exists"
    
    # Try to query
    if command -v sqlite3 &> /dev/null; then
        TABLES=$(sqlite3 "$BACKEND_DIR/vouchers.sqlite" ".tables" 2>/dev/null | wc -w)
        if [ "$TABLES" -gt 0 ]; then
            log_pass "Database has $TABLES tables initialized"
        else
            log_warn "Database file exists but tables not initialized"
        fi
    fi
else
    log_warn "SQLite database file not created yet (run 'npm run db:migrate')"
fi

echo ""

##############################################################################
# SECTION 7: CONSTITUTIONAL DOCUMENTATION
##############################################################################
echo "📋 SECTION 7: Constitutional Documentation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DOCS=(
    "README_CONSTITUCIONAL.md"
    "CONSTITUCION_SISTEMA_VOUCHERS.md"
    "CONSTITUCION_SISTEMA_VOUCHERS_PARTE_2.md"
    "INTEGRACION_CONSTITUCIONAL.md"
    "RESUMEN_EJECUTIVO.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$PROJECT_ROOT/$doc" ]; then
        SIZE=$(du -h "$PROJECT_ROOT/$doc" | cut -f1)
        log_pass "Document: $doc ($SIZE)"
    else
        log_fail "Document: $doc (MISSING)"
    fi
done

echo ""

##############################################################################
# SECTION 8: SCRIPTS
##############################################################################
echo "📋 SECTION 8: Setup Scripts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SCRIPTS=(
    "scripts/setup-all.sh"
    "scripts/setup-hexagonal-structure.sh"
    "scripts/setup-config.sh"
    "scripts/setup-dependencies.sh"
    "scripts/setup-database.sh"
    "scripts/generate-secrets.sh"
    "scripts/verify-setup.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [ -x "$PROJECT_ROOT/$script" ]; then
        log_pass "Script: $(basename $script) (executable)"
    elif [ -f "$PROJECT_ROOT/$script" ]; then
        log_warn "Script: $(basename $script) (exists but not executable)"
    else
        log_fail "Script: $(basename $script) (MISSING)"
    fi
done

echo ""

##############################################################################
# SECTION 9: GIT CONFIGURATION
##############################################################################
echo "📋 SECTION 9: Git Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "$PROJECT_ROOT/.git" ]; then
    log_pass "Git repository initialized"
    
    if [ -f "$PROJECT_ROOT/.gitignore" ]; then
        if grep -q "node_modules" "$PROJECT_ROOT/.gitignore"; then
            log_pass ".gitignore has node_modules"
        else
            log_warn ".gitignore missing node_modules"
        fi
        
        if grep -q "\.env$" "$PROJECT_ROOT/.gitignore" || grep -q "^\.env$" "$PROJECT_ROOT/.gitignore"; then
            log_pass ".gitignore has .env"
        else
            log_warn ".gitignore missing .env (SECURITY RISK!)"
        fi
    else
        log_warn ".gitignore not found"
    fi
else
    log_warn "Not a git repository"
fi

echo ""

##############################################################################
# SUMMARY & RECOMMENDATIONS
##############################################################################
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              VERIFICATION SUMMARY                             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

echo "Results:"
echo "  ✅ Passed:  $PASSED"
echo "  ❌ Failed:  $FAILED"
echo "  ⚠️  Warnings: $WARNINGS"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "✨ SETUP VERIFICATION COMPLETE - All checks passed!"
    HEALTH="HEALTHY"
else
    echo "⚠️  SETUP VERIFICATION INCOMPLETE - Please fix failures above"
    HEALTH="ISSUES FOUND"
fi

echo ""

# Recommendations
if [ $FAILED -gt 0 ]; then
    echo "📋 RECOMMENDED ACTIONS:"
    echo ""
    if ! [ -d "$BACKEND_DIR/node_modules" ]; then
        echo "  1. Install dependencies:"
        echo "     cd $BACKEND_DIR"
        echo "     npm install"
        echo ""
    fi
    
    if ! [ -f "$BACKEND_DIR/vouchers.sqlite" ]; then
        echo "  2. Initialize database:"
        echo "     cd $BACKEND_DIR"
        echo "     npm run db:migrate"
        echo ""
    fi
    
    if grep -q "CHANGE_ME" "$BACKEND_DIR/.env" 2>/dev/null; then
        echo "  3. Generate and set secrets:"
        echo "     bash scripts/generate-secrets.sh"
        echo ""
    fi
fi

if [ $WARNINGS -gt 0 ]; then
    echo "⚠️  OPTIONAL IMPROVEMENTS:"
    echo ""
    echo "  • Install sqlite3 CLI for database inspection"
    echo "  • Ensure .gitignore excludes all secrets"
    echo "  • Run 'npm run lint' to check code quality"
    echo "  • Run 'npm run test' to validate tests"
    echo ""
fi

echo "📊 Setup Health: $HEALTH"
echo ""

# Exit code
if [ $FAILED -eq 0 ]; then
    exit 0
else
    exit 1
fi
