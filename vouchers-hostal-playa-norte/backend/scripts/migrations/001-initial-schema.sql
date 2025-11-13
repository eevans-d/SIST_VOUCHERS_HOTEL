-- ============================================================================
-- PostgreSQL Initial Schema
-- Migración desde SQLite a PostgreSQL para Railway deployment
-- Fecha: 2025-11-10
-- ============================================================================

-- Habilitar extensión UUID (si no está habilitada)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: users
-- Purpose: User accounts and authentication with RBAC
-- Roles: admin (full access), recepcionista (guest management), usuario (guest)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  "passwordHash" VARCHAR(255) NOT NULL,
  "firstName" VARCHAR(100) NOT NULL,
  "lastName" VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(50) NOT NULL DEFAULT 'usuario'
    CHECK (role IN ('admin', 'recepcionista', 'usuario')),
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "lastLogin" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users("isActive");

-- ============================================================================
-- TABLE: stays
-- Purpose: Hotel check-in/check-out periods for guests
-- Lifecycle: pending -> active -> completed/cancelled
-- ============================================================================
CREATE TABLE IF NOT EXISTS stays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL,
  "hotelCode" VARCHAR(50) NOT NULL DEFAULT 'HPD',
  "roomNumber" VARCHAR(20) NOT NULL,
  "checkInDate" DATE NOT NULL,
  "checkOutDate" DATE NOT NULL,
  "numberOfGuests" INTEGER DEFAULT 1 CHECK ("numberOfGuests" > 0),
  "numberOfNights" INTEGER DEFAULT 1 CHECK ("numberOfNights" > 0),
  "roomType" VARCHAR(50),
  "basePrice" DECIMAL(10, 2) DEFAULT 0,
  "totalPrice" DECIMAL(10, 2) DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  notes TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_stays_user_id ON stays("userId");
CREATE INDEX idx_stays_room_number ON stays("roomNumber");
CREATE INDEX idx_stays_status ON stays(status);
CREATE INDEX idx_stays_check_in ON stays("checkInDate");
CREATE INDEX idx_stays_check_out ON stays("checkOutDate");
CREATE INDEX idx_stays_user_status ON stays("userId", status);
CREATE INDEX idx_stays_checkin_checkout ON stays("checkInDate", "checkOutDate");

-- ============================================================================
-- TABLE: vouchers
-- Purpose: Discount vouchers for cafe/meals with HMAC security
-- Lifecycle: pending -> active -> redeemed/expired/cancelled
-- Security: code is HMAC-signed, qrCode contains signed payload
-- ============================================================================
CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "stayId" UUID NOT NULL,
  code VARCHAR(100) NOT NULL UNIQUE,
  "qrCode" TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'redeemed', 'expired', 'cancelled')),
  "redemptionDate" TIMESTAMP,
  "expiryDate" TIMESTAMP NOT NULL,
  "redemptionNotes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("stayId") REFERENCES stays(id) ON DELETE CASCADE
);

CREATE INDEX idx_vouchers_stay_id ON vouchers("stayId");
CREATE INDEX idx_vouchers_code ON vouchers(code);
CREATE INDEX idx_vouchers_status ON vouchers(status);
CREATE INDEX idx_vouchers_expiry_date ON vouchers("expiryDate");
CREATE INDEX idx_vouchers_redemption_date ON vouchers("redemptionDate");
CREATE INDEX idx_vouchers_status_expiry ON vouchers(status, "expiryDate" DESC);

-- Partial index para vouchers redimidos (optimización consultas reportes)
CREATE INDEX idx_vouchers_redeemed_date ON vouchers(status, "redemptionDate" DESC)
  WHERE status = 'redeemed';

-- ============================================================================
-- TABLE: orders
-- Purpose: Cafe/meal orders during stay
-- Lifecycle: open -> completed/cancelled
-- Financial: total (antes descuento), discountAmount, finalTotal (después descuento)
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "stayId" UUID NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed', 'cancelled')),
  total DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  "discountAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK ("discountAmount" >= 0),
  "finalTotal" DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK ("finalTotal" >= 0),
  notes TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("stayId") REFERENCES stays(id) ON DELETE CASCADE
);

CREATE INDEX idx_orders_stay_id ON orders("stayId");
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders("createdAt");
CREATE INDEX idx_orders_status_created ON orders(status, "createdAt" DESC);

-- ============================================================================
-- TABLE: order_items
-- Purpose: Line items dentro de una orden (M:N orders-products)
-- Denormalizado: productName guardado por snapshot semántico
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "orderId" UUID NOT NULL,
  "productCode" VARCHAR(50) NOT NULL,
  "productName" VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  "unitPrice" DECIMAL(10, 2) NOT NULL CHECK ("unitPrice" >= 0),
  subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
  FOREIGN KEY ("orderId") REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX idx_order_items_order_id ON order_items("orderId");
CREATE INDEX idx_order_items_product_code ON order_items("productCode");

-- ============================================================================
-- TABLE: order_vouchers
-- Purpose: Junction table - Many-to-Many relationship between orders and vouchers
-- Denormalizado: discountApplied guardado por snapshot histórico
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_vouchers (
  "orderId" UUID NOT NULL,
  "voucherId" UUID NOT NULL,
  "discountApplied" DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK ("discountApplied" >= 0),
  "appliedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("orderId", "voucherId"),
  FOREIGN KEY ("orderId") REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY ("voucherId") REFERENCES vouchers(id) ON DELETE CASCADE
);

CREATE INDEX idx_order_vouchers_voucher_id ON order_vouchers("voucherId");

-- ============================================================================
-- TABLE: audit_logs (opcional - preparado para futuro)
-- Purpose: Security and compliance - track all important operations
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID,
  action VARCHAR(100) NOT NULL,
  "entityType" VARCHAR(100) NOT NULL,
  "entityId" UUID NOT NULL,
  changes JSONB,
  "ipAddress" VARCHAR(50),
  "userAgent" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs("userId");
CREATE INDEX idx_audit_logs_entity_type ON audit_logs("entityType");
CREATE INDEX idx_audit_logs_entity_id ON audit_logs("entityId");
CREATE INDEX idx_audit_logs_created_at ON audit_logs("createdAt" DESC);

-- ============================================================================
-- FUNCTION: update_updated_at_column
-- Purpose: Trigger para actualizar automáticamente updatedAt en cada UPDATE
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para auto-actualizar updatedAt
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stays_updated_at BEFORE UPDATE ON stays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vouchers_updated_at BEFORE UPDATE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION QUERIES (comentadas - usar para debug)
-- ============================================================================

-- Verificar todas las tablas creadas
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Verificar todos los índices
-- SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;

-- Verificar todos los triggers
-- SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgisinternal = false;

-- Verificar foreign keys
-- SELECT
--   tc.table_name,
--   kcu.column_name,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
-- ORDER BY tc.table_name;
