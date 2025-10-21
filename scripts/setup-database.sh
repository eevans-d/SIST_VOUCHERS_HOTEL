#!/bin/bash

##############################################################################
# SETUP DATABASE SCHEMA
# Crea las tablas SQLite base con integridad referencial completa
#
# Uso: bash scripts/setup-database.sh
# Duración: ~20 segundos
# Pilares: 8.1 (Data), 1.2 (Architecture)
##############################################################################

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ ${NC}$1"; }
log_success() { echo -e "${GREEN}✅ ${NC}$1"; }
log_warn() { echo -e "${YELLOW}⚠️  ${NC}$1"; }
log_error() { echo -e "${RED}❌ ${NC}$1"; }

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/vouchers-hostal-playa-norte/backend"
DB_PATH="$BACKEND_DIR/vouchers.sqlite"

log_info "=========================================="
log_info "DATABASE SCHEMA INITIALIZATION"
log_info "Pilar 8.1 - Data Governance"
log_info "=========================================="

# Crear directorio de base de datos si no existe
mkdir -p "$(dirname "$DB_PATH")"
log_success "Database directory ready: $(dirname "$DB_PATH")"

##############################################################################
# SCHEMA SQL - Constitutional Tables
##############################################################################

cat > "$BACKEND_DIR/src/infrastructure/persistence/migrations/001-initial-schema.sql" << 'EOF'
-- ============================================================================
-- VOUCHER SYSTEM - INITIAL SCHEMA
-- Constitutional Database Design (Pilar 8.1)
-- ============================================================================

-- Enable foreign keys
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ============================================================================
-- 1. USERS TABLE (Role-Based Access Control - Pilar 5.1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'manager', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- ============================================================================
-- 2. VOUCHERS TABLE (Core Entity - Pilar 8.1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vouchers (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'ARS' CHECK (length(currency) = 3),
    
    -- Status flow: CREATED -> ACTIVATED -> REDEEMED or CANCELLED
    status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN (
        'CREATED', 'ACTIVATED', 'REDEEMED', 'CANCELLED', 'EXPIRED'
    )),
    
    -- Redemption tracking (Pilar 8.2)
    redeemed_at TEXT,
    redeemed_by_user_id TEXT REFERENCES users(id),
    
    -- Expiration (Business Logic)
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    -- QR and verification
    qr_code TEXT UNIQUE NOT NULL,
    hmac_signature TEXT NOT NULL,
    
    -- Audit trail
    created_by_user_id TEXT REFERENCES users(id),
    correlation_id TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_vouchers_code ON vouchers(code);
CREATE UNIQUE INDEX idx_vouchers_qr ON vouchers(qr_code);
CREATE INDEX idx_vouchers_status ON vouchers(status);
CREATE INDEX idx_vouchers_expires_at ON vouchers(expires_at);
CREATE INDEX idx_vouchers_created_by ON vouchers(created_by_user_id);
CREATE INDEX idx_vouchers_correlation ON vouchers(correlation_id);

-- ============================================================================
-- 3. REDEMPTION_LOGS TABLE (Audit Trail - Pilar 8.2, 2.2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS redemption_logs (
    id TEXT PRIMARY KEY,
    voucher_id TEXT NOT NULL REFERENCES vouchers(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    
    -- Details
    amount_redeemed_cents INTEGER NOT NULL CHECK (amount_redeemed_cents > 0),
    location TEXT,
    payment_method TEXT,
    
    -- Status and retry logic
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN (
        'PENDING', 'COMPLETED', 'FAILED', 'ROLLED_BACK'
    )),
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    -- Correlation
    correlation_id TEXT NOT NULL,
    request_id TEXT UNIQUE NOT NULL
);

CREATE INDEX idx_redemption_voucher ON redemption_logs(voucher_id);
CREATE INDEX idx_redemption_user ON redemption_logs(user_id);
CREATE INDEX idx_redemption_status ON redemption_logs(status);
CREATE INDEX idx_redemption_created_at ON redemption_logs(created_at);
CREATE INDEX idx_redemption_correlation ON redemption_logs(correlation_id);

-- ============================================================================
-- 4. SYNC_LOGS TABLE (Offline-First Architecture - Pilar 1.2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_logs (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('PULL', 'PUSH', 'FULL')),
    
    -- Sync data
    vouchers_synced INTEGER NOT NULL DEFAULT 0,
    redemptions_synced INTEGER NOT NULL DEFAULT 0,
    conflicts_resolved INTEGER NOT NULL DEFAULT 0,
    
    -- Status
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'PARTIAL', 'FAILED')),
    error_message TEXT,
    
    -- Timestamps
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    duration_ms INTEGER,
    
    -- Correlation
    correlation_id TEXT NOT NULL
);

CREATE INDEX idx_sync_device ON sync_logs(device_id);
CREATE INDEX idx_sync_status ON sync_logs(status);
CREATE INDEX idx_sync_started ON sync_logs(started_at);

-- ============================================================================
-- 5. BUSINESS_METRICS TABLE (Observability - Pilar 6.2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS business_metrics (
    id TEXT PRIMARY KEY,
    metric_type TEXT NOT NULL CHECK (metric_type IN (
        'ADOPTION', 'REDEMPTION_RATE', 'USER_SATISFACTION', 
        'REVENUE_IMPACT', 'OPERATIONAL_COST'
    )),
    
    -- Value
    value REAL NOT NULL,
    target REAL,
    unit TEXT,
    
    -- Time series
    measured_at TEXT NOT NULL DEFAULT (datetime('now')),
    period TEXT NOT NULL CHECK (period IN ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY')),
    
    -- Context
    dimension TEXT,  -- e.g., 'by_user_role', 'by_location'
    dimension_value TEXT
);

CREATE INDEX idx_metrics_type ON business_metrics(metric_type);
CREATE INDEX idx_metrics_measured_at ON business_metrics(measured_at);
CREATE INDEX idx_metrics_period ON business_metrics(period);

-- ============================================================================
-- 6. API_AUDIT_LOG TABLE (Security & Compliance - Pilar 5.3, 2.2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    
    -- Request details
    method TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    
    -- Security
    ip_address TEXT,
    user_agent TEXT,
    auth_token_hash TEXT,
    
    -- Performance
    response_time_ms INTEGER,
    payload_size_bytes INTEGER,
    
    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    -- Correlation
    correlation_id TEXT NOT NULL REFERENCES vouchers(correlation_id)
);

CREATE INDEX idx_audit_user ON api_audit_log(user_id);
CREATE INDEX idx_audit_endpoint ON api_audit_log(endpoint);
CREATE INDEX idx_audit_created_at ON api_audit_log(created_at);
CREATE INDEX idx_audit_correlation ON api_audit_log(correlation_id);

-- ============================================================================
-- 7. CONSTITUTIONAL_COMPLIANCE_LOG TABLE (Governance - Pilar 10.2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS constitutional_compliance_log (
    id TEXT PRIMARY KEY,
    pilar INTEGER NOT NULL CHECK (pilar BETWEEN 1 AND 12),
    pilar_name TEXT NOT NULL,
    
    -- Compliance check details
    check_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL', 'WARNING')),
    evidence TEXT,
    
    -- Remediation
    remediation_required TEXT,
    remediation_status TEXT DEFAULT 'PENDING',
    
    -- Timestamps
    checked_at TEXT NOT NULL DEFAULT (datetime('now')),
    remediated_at TEXT,
    next_check_at TEXT
);

CREATE INDEX idx_compliance_pilar ON constitutional_compliance_log(pilar);
CREATE INDEX idx_compliance_status ON constitutional_compliance_log(status);
CREATE INDEX idx_compliance_checked_at ON constitutional_compliance_log(checked_at);

-- ============================================================================
-- 8. COST_TRACKING TABLE (Cost Control - Pilar 12.1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cost_tracking (
    id TEXT PRIMARY KEY,
    cost_category TEXT NOT NULL CHECK (cost_category IN (
        'INFRASTRUCTURE', 'PERSONNEL', 'THIRD_PARTY', 'DEVELOPMENT', 'OPERATIONS'
    )),
    
    -- Details
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ARS',
    
    -- Budget tracking
    budgeted_amount_cents INTEGER,
    variance_percent REAL,
    
    -- Timestamps
    incurred_at TEXT NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
    period_month TEXT NOT NULL  -- YYYY-MM format
);

CREATE INDEX idx_cost_category ON cost_tracking(cost_category);
CREATE INDEX idx_cost_period ON cost_tracking(period_month);
CREATE INDEX idx_cost_incurred ON cost_tracking(incurred_at);

-- ============================================================================
-- INITIAL DATA - Reference Tables
-- ============================================================================

-- Admin user (MUST change password on first login - Pilar 5.1)
INSERT OR IGNORE INTO users (id, email, password_hash, full_name, role)
VALUES (
    'admin-001',
    'admin@hostal-playa-norte.local',
    '$2b$12$PLACEHOLDER_HASH_CHANGE_ME',
    'System Administrator',
    'admin'
);

-- ============================================================================
-- VIEWS - Constitutional Reporting
-- ============================================================================

-- View: Current Redemption Status
CREATE VIEW IF NOT EXISTS v_redemption_status AS
SELECT 
    v.status,
    COUNT(*) as voucher_count,
    SUM(v.amount_cents) / 100.0 as total_amount,
    COUNT(DISTINCT v.created_by_user_id) as created_by_users,
    MAX(v.updated_at) as last_update
FROM vouchers v
GROUP BY v.status;

-- View: User Activity
CREATE VIEW IF NOT EXISTS v_user_activity AS
SELECT 
    u.id,
    u.email,
    u.role,
    COUNT(DISTINCT rl.id) as redemptions_count,
    MAX(rl.created_at) as last_redemption,
    COUNT(DISTINCT v.id) as vouchers_created,
    u.last_login_at
FROM users u
LEFT JOIN redemption_logs rl ON u.id = rl.user_id
LEFT JOIN vouchers v ON u.id = v.created_by_user_id
GROUP BY u.id;

-- View: Daily Metrics
CREATE VIEW IF NOT EXISTS v_daily_metrics AS
SELECT 
    DATE(v.created_at) as day,
    COUNT(DISTINCT v.id) as vouchers_created,
    COUNT(DISTINCT CASE WHEN v.status = 'REDEEMED' THEN v.id END) as vouchers_redeemed,
    SUM(v.amount_cents) / 100.0 as total_amount,
    COUNT(DISTINCT rl.id) as total_redemptions
FROM vouchers v
LEFT JOIN redemption_logs rl ON v.id = rl.voucher_id
GROUP BY DATE(v.created_at);

-- ============================================================================
-- PRAGMA SETTINGS (Pilar 8.1 - Data Integrity)
-- ============================================================================
PRAGMA synchronous = FULL;
PRAGMA integrity_check;
EOF

log_success "Created 001-initial-schema.sql"

##############################################################################
# CREATE DATABASE WITH NODE.JS SCRIPT
##############################################################################

log_info ""
log_info "Creating database initialization script (Node.js)..."

cat > "$BACKEND_DIR/src/infrastructure/persistence/db-init.js" << 'EOF'
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initializeDatabase(dbPath) {
  console.log('🔧 Initializing database...');
  
  const db = new Database(dbPath, {
    timeout: 5000,
    fileMustExist: false
  });

  try {
    // Enable WAL mode
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('synchronous = FULL');
    
    console.log('✅ WAL mode enabled');
    console.log('✅ Foreign keys enabled');

    // Read and execute schema
    const schemaPath = path.join(__dirname, 'migrations', '001-initial-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    db.exec(schema);
    console.log('✅ Schema created successfully');

    // Verify tables
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();

    console.log('\n📊 Tables created:');
    tables.forEach(t => console.log(`   • ${t.name}`));

    // Check integrity
    const integrity = db.pragma('integrity_check');
    if (integrity[0]?.ok === 'ok') {
      console.log('\n✅ Database integrity verified');
    } else {
      console.error('❌ Database integrity check failed:', integrity);
    }

    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  } finally {
    db.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbPath = process.env.DATABASE_PATH || './vouchers.sqlite';
  await initializeDatabase(dbPath).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export default initializeDatabase;
EOF

log_success "Created db-init.js (Node.js initialization)"

##############################################################################
# CREATE SEEDING SCRIPT
##############################################################################

log_info ""
log_info "Creating database seeding script..."

cat > "$BACKEND_DIR/src/infrastructure/persistence/db-seed.js" << 'EOF'
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { createHmac } from 'crypto';

export async function seedDatabase(dbPath) {
  const db = new Database(dbPath, { timeout: 5000 });

  try {
    // Create test vouchers
    const createVoucher = db.prepare(`
      INSERT INTO vouchers (
        id, code, amount_cents, status, qr_code, hmac_signature,
        expires_at, created_by_user_id, correlation_id, currency
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    console.log('🌱 Seeding test data...');

    // Insert 10 test vouchers
    for (let i = 1; i <= 10; i++) {
      const id = uuidv4();
      const code = `VOUCHER-${String(i).padStart(5, '0')}`;
      const qrCode = `QR-${id}`;
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const hmac = createHmac('sha256', process.env.VOUCHER_SECRET || 'dev-secret')
        .update(code)
        .digest('hex');

      createVoucher.run(
        id,
        code,
        10000 + (i * 100),  // 100-110 ARS
        'ACTIVATED',
        qrCode,
        hmac,
        expiresAt,
        'admin-001',
        uuidv4(),
        'ARS'
      );

      console.log(`   ✅ Created ${code}`);
    }

    // Insert test metrics
    const createMetric = db.prepare(`
      INSERT INTO business_metrics (
        id, metric_type, value, target, unit, period, measured_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    createMetric.run(
      uuidv4(), 'ADOPTION', 85, 95, '%', 'DAILY', new Date().toISOString()
    );

    console.log('✅ Seeding completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    throw error;
  } finally {
    db.close();
  }
}

export default seedDatabase;
EOF

log_success "Created db-seed.js (Database seeding)"

##############################################################################
# SUMMARY
##############################################################################

log_info ""
log_success "=========================================="
log_success "DATABASE SCHEMA CREATED"
log_success "=========================================="
log_info ""

log_info "Files Created:"
echo "  • src/infrastructure/persistence/migrations/001-initial-schema.sql"
echo "  • src/infrastructure/persistence/db-init.js"
echo "  • src/infrastructure/persistence/db-seed.js"
echo ""

log_warn "NEXT STEPS:"
echo ""
echo "1. Create logs directory:"
echo "   mkdir -p vouchers-hostal-playa-norte/backend/logs"
echo ""
echo "2. Generate database with Node.js:"
echo "   cd vouchers-hostal-playa-norte/backend"
echo "   npm run db:migrate"
echo ""
echo "3. (Optional) Seed test data:"
echo "   npm run db:seed"
echo ""
echo "4. Verify database created:"
echo "   sqlite3 vouchers.sqlite '.tables'"
echo ""

log_success "Database Schema Setup Complete! ✨"
