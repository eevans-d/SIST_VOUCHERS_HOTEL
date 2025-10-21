# 🏗️ BLUEPRINT ARQUITECTÓNICO
## Sistema Vouchers Digitales - Hostal Playa Norte

---

## 📐 DIAGRAMA DE ARQUITECTURA COMPLETA

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CAPA DE PRESENTACIÓN (PWA)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────┐  │
│  │  Login & Auth   │  │  Scanner QR      │  │  Redemption Manager     │  │
│  │  - JWT Storage  │  │  - HTML5 QR      │  │  - Form validation      │  │
│  │  - Role display │  │  - Manual input  │  │  - Offline queue        │  │
│  │  - Session mgmt │  │  - HMAC validate │  │  - Conflict resolution  │  │
│  └─────────────────┘  └──────────────────┘  └─────────────────────────┘  │
│                                                                             │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────┐  │
│  │  Sync Status    │  │  Reports View    │  │  Settings               │  │
│  │  - Online/Off   │  │  - Daily summary │  │  - Device config        │  │
│  │  - Pending cnt  │  │  - CSV export    │  │  - User preferences     │  │
│  │  - Conflicts    │  │  - Metrics       │  │  - About                │  │
│  └─────────────────┘  └──────────────────┘  └─────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ HTTPS + JWT
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SERVICE WORKER LAYER                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                     CACHE STRATEGY                                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │  │
│  │  │ Static Assets│  │  API Calls   │  │  Background Sync         │ │  │
│  │  │ Cache-First  │  │ Network-First│  │  - sync-redemptions      │ │  │
│  │  │ (HTML/CSS/JS)│  │ (with cache) │  │  - sync-conflicts        │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                     INDEXEDDB STORAGE                               │  │
│  │  ┌──────────────────┐  ┌───────────────┐  ┌───────────────────┐   │  │
│  │  │pending_redemptions│  │vouchers_cache│  │  sync_conflicts   │   │  │
│  │  │  - local_id      │  │  - code       │  │  - conflict_id    │   │  │
│  │  │  - voucher_code  │  │  - guest_name │  │  - local_data     │   │  │
│  │  │  - timestamp     │  │  - validation │  │  - server_data    │   │  │
│  │  │  - attempts      │  │  - cached_at  │  │  - resolution     │   │  │
│  │  └──────────────────┘  └───────────────┘  └───────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ REST API
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          API LAYER (Express.js)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────── MIDDLEWARE ─────────────────────────────┐  │
│  │                                                                       │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │  │
│  │  │ Correlation  │→ │     Auth     │→ │ Rate Limiter │              │  │
│  │  │     ID       │  │ JWT + RBAC   │  │  Per Device  │              │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │  │
│  │                           │                                          │  │
│  │                           ▼                                          │  │
│  │  ┌────────────────────────────────────────────────────────────────┐ │  │
│  │  │                    ROUTES                                      │ │  │
│  │  │  /api/auth/*      /api/vouchers/*    /api/sync/*             │ │  │
│  │  │  /api/reports/*   /api/health                                 │ │  │
│  │  └────────────────────────────────────────────────────────────────┘ │  │
│  │                           │                                          │  │
│  │                           ▼                                          │  │
│  │  ┌────────────────────────────────────────────────────────────────┐ │  │
│  │  │                  SERVICES LAYER                                │ │  │
│  │  │                                                                │ │  │
│  │  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐  │ │  │
│  │  │  │ VoucherService  │  │  SyncService    │  │ CryptoService│  │ │  │
│  │  │  │ - emit()        │  │ - sync()        │  │ - HMAC       │  │ │  │
│  │  │  │ - validate()    │  │ - conflicts()   │  │ - verify()   │  │ │  │
│  │  │  │ - redeem()      │  │ - resolve()     │  │ - generate() │  │ │  │
│  │  │  └─────────────────┘  └─────────────────┘  └──────────────┘  │ │  │
│  │  │                                                                │ │  │
│  │  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐  │ │  │
│  │  │  │   QRService     │  │  ReportService  │  │ AuthService  │  │ │  │
│  │  │  │ - generate()    │  │ - csv()         │  │ - login()    │  │ │  │
│  │  │  │ - parse()       │  │ - metrics()     │  │ - refresh()  │  │ │  │
│  │  │  │ - validate()    │  │ - reconcile()   │  │ - logout()   │  │ │  │
│  │  │  └─────────────────┘  └─────────────────┘  └──────────────┘  │ │  │
│  │  └────────────────────────────────────────────────────────────────┘ │  │
│  │                           │                                          │  │
│  │                           ▼                                          │  │
│  │  ┌────────────────────────────────────────────────────────────────┐ │  │
│  │  │                  ERROR HANDLER                                 │ │  │
│  │  │  - AppError / ValidationError / ConflictError                 │ │  │
│  │  │  - Structured logging (Winston)                               │ │  │
│  │  │  - Correlation ID tracking                                    │ │  │
│  │  └────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ SQL Transactions
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER (SQLite)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────── DATABASE SCHEMA ──────────────────────────┐│
│  │                                                                         ││
│  │  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐  ││
│  │  │    users     │     │  cafeterias  │     │       stays          │  ││
│  │  ├──────────────┤     ├──────────────┤     ├──────────────────────┤  ││
│  │  │ id (PK)      │     │ id (PK)      │     │ id (PK)              │  ││
│  │  │ username     │     │ name         │     │ guest_name           │  ││
│  │  │ password_hash│     │ location     │     │ room_number          │  ││
│  │  │ role         │     │ is_active    │     │ checkin_date         │  ││
│  │  │ cafeteria_id │     │ created_at   │     │ checkout_date        │  ││
│  │  └──────────────┘     └──────────────┘     │ created_at           │  ││
│  │                                             └──────────────────────┘  ││
│  │                              │                        │               ││
│  │                              ▼                        ▼               ││
│  │                       ┌──────────────────────────────────────┐       ││
│  │                       │           vouchers               │       ││
│  │                       ├──────────────────────────────────────┤       ││
│  │                       │ id (PK)                              │       ││
│  │                       │ code (UNIQUE)  ◄─── HPN-YYYY-####   │       ││
│  │                       │ stay_id (FK) ──────────┘             │       ││
│  │                       │ valid_from (DATE)                    │       ││
│  │                       │ valid_until (DATE)                   │       ││
│  │                       │ hmac_signature (SHA256)              │       ││
│  │                       │ status (active/redeemed/expired)     │       ││
│  │                       │ created_at                           │       ││
│  │                       └──────────────────────────────────────┘       ││
│  │                                      │                               ││
│  │                                      ▼                               ││
│  │                       ┌──────────────────────────────────────┐       ││
│  │                       │         redemptions              │       ││
│  │                       ├──────────────────────────────────────┤       ││
│  │                       │ id (PK)                              │       ││
│  │                       │ voucher_id (FK, UNIQUE) ◄── ATOMIC   │       ││
│  │                       │ cafeteria_id (FK)                    │       ││
│  │                       │ device_id                            │       ││
│  │                       │ redeemed_at (TIMESTAMP)              │       ││
│  │                       │ redeemed_by (FK)                     │       ││
│  │                       │ correlation_id                       │       ││
│  │                       └──────────────────────────────────────┘       ││
│  │                                                                       ││
│  │  ┌────────────────────────────────────────────────────────────────┐  ││
│  │  │                      sync_log                                  │  ││
│  │  ├────────────────────────────────────────────────────────────────┤  ││
│  │  │ id (PK)                                                        │  ││
│  │  │ device_id                                                      │  ││
│  │  │ operation (redemption/conflict)                               │  ││
│  │  │ payload (JSON)                                                │  ││
│  │  │ result (success/error)                                        │  ││
│  │  │ synced_at (TIMESTAMP)                                         │  ││
│  │  └────────────────────────────────────────────────────────────────┘  ││
│  │                                                                       ││
│  │  KEY FEATURES:                                                        ││
│  │  ✓ UNIQUE(voucher_id) en redemptions → Previene doble canje         ││
│  │  ✓ Foreign Keys con CASCADE → Integridad referencial                ││
│  │  ✓ Indexes en code, device_id → Performance                         ││
│  │  ✓ WAL mode → Concurrencia mejorada                                 ││
│  │  ✓ Transacciones ACID → Consistencia garantizada                    ││
│  └───────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ Persistent Volume
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          INFRAESTRUCTURA (Fly.io)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────── DEPLOYMENT ────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌──────────────────┐         ┌──────────────────┐                 │   │
│  │  │   Load Balancer  │────────▶│   App Instance   │                 │   │
│  │  │   (Fly Proxy)    │         │   (Node.js)      │                 │   │
│  │  │   - SSL/TLS      │         │   - Port 8080    │                 │   │
│  │  │   - Health check │         │   - 256MB RAM    │                 │   │
│  │  └──────────────────┘         └──────────────────┘                 │   │
│  │                                        │                            │   │
│  │                                        ▼                            │   │
│  │                               ┌──────────────────┐                  │   │
│  │                               │  Volume (1GB)    │                  │   │
│  │                               │  /data/          │                  │   │
│  │                               │  - vouchers.db   │                  │   │
│  │                               │  - logs/         │                  │   │
│  │                               └──────────────────┘                  │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │                    SECRETS MANAGER                           │  │   │
│  │  │  - VOUCHER_SECRET (32-byte hex)                             │  │   │
│  │  │  - JWT_SECRET (32-byte hex)                                 │  │   │
│  │  │  - ALLOWED_ORIGINS (domains)                                │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │                    MONITORING                                │  │   │
│  │  │  - Health checks (every 30s)                                │  │   │
│  │  │  - Logs aggregation                                         │  │   │
│  │  │  - Metrics export                                           │  │   │
│  │  │  - Auto-restart on failure                                  │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 FLUJO DE DATOS CRÍTICOS

### 1. EMISIÓN DE VOUCHERS

```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│ Admin/   │  POST   │   API    │ Generate│   DB     │  Return │  Admin   │
│Reception │────────▶│/vouchers │────────▶│ INSERT   │────────▶│ + QR PDF │
└──────────┘         └──────────┘         └──────────┘         └──────────┘
     │                    │                     │                     │
     │ 1. stay_id         │ 2. Validate        │ 3. Generate code    │
     │    valid_from      │    - Stay exists   │    HPN-2025-0001    │
     │    valid_until     │    - Dates valid   │                     │
     │    breakfast_count │    - In range      │ 4. Create HMAC      │
     │                    │                     │    SHA256 signature │
     │                    │ 5. Transaction()   │                     │
     │                    │    BEGIN           │ 6. INSERT vouchers  │
     │                    │    FOR EACH        │    (atomic)         │
     │                    │    COMMIT          │                     │
     │                    │                     │                     │
     │                    │ 7. Generate QR     │                     │
     │                    │    code|hmac|date  │                     │
     │                    │                     │                     │
     │◀───────────────────┴─────────────────────┴─────────────────────┘
     │ 8. Return: { vouchers: [...], qr_images: [...] }
```

### 2. VALIDACIÓN DE VOUCHER

```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│Cafeteria │  POST   │   API    │  Query  │   DB     │  Return │Cafeteria │
│   PWA    │────────▶│/validate │────────▶│  SELECT  │────────▶│  Result  │
└──────────┘         └──────────┘         └──────────┘         └──────────┘
     │                    │                     │                     │
     │ 1. code, hmac      │ 2. Get voucher     │ 3. Return data      │
     │                    │                     │    + stay info      │
     │                    │ 4. Verify HMAC     │                     │
     │                    │    timing-safe     │                     │
     │                    │                     │                     │
     │                    │ 5. Check status    │                     │
     │                    │    ✓ active?       │                     │
     │                    │    ✓ not expired?  │                     │
     │                    │    ✓ not redeemed? │                     │
     │                    │                     │                     │
     │◀───────────────────┴─────────────────────┴─────────────────────┘
     │ 6. { valid: true/false, reason, voucher_data }
```

### 3. CANJE ONLINE (ATÓMICO)

```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│Cafeteria │  POST   │   API    │TRANSACT.│   DB     │  Return │Cafeteria │
│   PWA    │────────▶│ /redeem  │────────▶│ ATOMIC   │────────▶│  Success │
└──────────┘         └──────────┘         └──────────┘         └──────────┘
     │                    │                     │                     │
     │ code, cafeteria,   │                     │                     │
     │ device_id          │ 1. BEGIN TRANS.    │                     │
     │                    │                     │                     │
     │                    │ 2. SELECT voucher  │                     │
     │                    │    FOR UPDATE      │                     │
     │                    │                     │                     │
     │                    │ 3. Validate        │                     │
     │                    │    ✓ exists        │                     │
     │                    │    ✓ active        │                     │
     │                    │    ✓ in date range │                     │
     │                    │                     │                     │
     │                    │ 4. INSERT          │ 5. UNIQUE constraint│
     │                    │    redemptions     │    PREVENTS DUPLICATE│
     │                    │    (voucher_id)    │                     │
     │                    │                     │                     │
     │                    │ 6. UPDATE voucher  │                     │
     │                    │    status=redeemed │                     │
     │                    │                     │                     │
     │                    │ 7. COMMIT          │                     │
     │                    │                     │                     │
     │◀───────────────────┴─────────────────────┴─────────────────────┘
     │ 8. { success: true, redemption: {...} }
     │
     │ ERROR HANDLING:
     │ - CONSTRAINT UNIQUE → { error: 'ALREADY_REDEEMED', details }
     │ - Expired → { error: 'EXPIRED' }
     │ - Invalid → { error: 'INVALID_VOUCHER' }
```

### 4. CANJE OFFLINE + SINCRONIZACIÓN

```
┌──────────┐                    ┌──────────┐                    ┌──────────┐
│Cafeteria │                    │IndexedDB │                    │   API    │
│   PWA    │                    │  Local   │                    │  Server  │
└──────────┘                    └──────────┘                    └──────────┘
     │                               │                               │
     │ 1. Scan QR                    │                               │
     │    (OFFLINE)                  │                               │
     ├──────────────────────────────▶│                               │
     │ 2. Validate HMAC locally      │                               │
     │                               │                               │
     │ 3. INSERT pending_redemptions │                               │
     │    {                          │                               │
     │      local_id: uuid(),        │                               │
     │      voucher_code,            │                               │
     │      cafeteria_id,            │                               │
     │      device_id,               │                               │
     │      timestamp,               │                               │
     │      attempts: 0              │                               │
     │    }                          │                               │
     ├──────────────────────────────▶│                               │
     │                               │                               │
     │ 4. Show "Queued for sync"    │                               │
     │                               │                               │
     │ ... TIME PASSES ...           │                               │
     │                               │                               │
     │ 5. ONLINE detected            │                               │
     ├──────────────────────────────▶│                               │
     │ 6. Service Worker triggers    │                               │
     │    'sync-redemptions'         │                               │
     │                               │                               │
     │                               │ 7. POST /api/sync/redemptions │
     │                               ├──────────────────────────────▶│
     │                               │   { device_id,                │
     │                               │     redemptions: [...] }      │
     │                               │                               │
     │                               │ 8. For each redemption:       │
     │                               │    - Try redeem()             │
     │                               │    - Handle conflicts         │
     │                               │    - Log to sync_log          │
     │                               │                               │
     │                               │◀──────────────────────────────│
     │                               │ 9. Return results:            │
     │                               │    { synced: [...],           │
     │                               │      conflicts: [...],        │
     │                               │      errors: [...] }          │
     │                               │                               │
     │ 10. DELETE synced from        │                               │
     │     IndexedDB                 │                               │
     │                               │                               │
     │ 11. KEEP conflicts for        │                               │
     │     user resolution           │                               │
     │                               │                               │
     │ 12. Show notification         │                               │
     │     "X canjes sincronizados"  │                               │
     │                               │                               │
```

### 5. REPORTE CSV (Test Case #10)

```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│Admin/    │   GET   │   API    │  Query  │   DB     │  Return │  Admin   │
│Reception │────────▶│/reports/ │────────▶│  JOIN    │────────▶│   CSV    │
│          │         │redemptions│         │ COMPLEX  │         │ Download │
└──────────┘         └──────────┘         └──────────┘         └──────────┘
     │                    │                     │                     │
     │ ?from=2025-01-01   │                     │                     │
     │ &to=2025-01-31     │                     │                     │
     │ &format=csv        │                     │                     │
     │                    │                     │                     │
     │                    │ SELECT              │                     │
     │                    │   v.code,           │                     │
     │                    │   s.guest_name,     │                     │
     │                    │   s.room_number,    │                     │
     │                    │   r.redeemed_at,    │                     │
     │                    │   c.name AS cafe,   │                     │
     │                    │   r.device_id       │                     │
     │                    │ FROM redemptions r  │                     │
     │                    │ JOIN vouchers v     │                     │
     │                    │ JOIN stays s        │                     │
     │                    │ JOIN cafeterias c   │                     │
     │                    │ WHERE redeemed_at   │                     │
     │                    │   BETWEEN ? AND ?   │                     │
     │                    │ ORDER BY            │                     │
     │                    │   redeemed_at       │                     │
     │                    │                     │                     │
     │                    │ Generate CSV:       │                     │
     │                    │ - Header row        │                     │
     │                    │ - Data rows         │                     │
     │                    │ - Include online+off│                     │
     │                    │                     │                     │
     │◀───────────────────┴─────────────────────┴─────────────────────┘
     │ CSV File:
     │ code,guest_name,room,redeemed_at,cafeteria,device_id
     │ HPN-2025-0001,Juan Pérez,101,2025-01-15 08:30,Cafetería,device-001
     │ HPN-2025-0002,Ana García,102,2025-01-15 08:45,Cafetería,device-001
     │ ...
```

---

## 🔐 SEGURIDAD Y AUTENTICACIÓN

### JWT Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Client  │  POST   │   API    │  Query  │   DB     │
│          │────────▶│  /login  │────────▶│  users   │
└──────────┘         └──────────┘         └──────────┘
     │                    │                     │
     │ username, password │                     │
     │                    │ 1. SELECT user      │
     │                    │    WHERE username   │
     │                    │                     │
     │                    │ 2. bcrypt.compare() │
     │                    │    password vs hash │
     │                    │                     │
     │                    │ 3. jwt.sign({       │
     │                    │      user_id,       │
     │                    │      username,      │
     │                    │      role,          │
     │                    │      cafeteria_id   │
     │                    │    }, JWT_SECRET,   │
     │                    │    { expiresIn })   │
     │                    │                     │
     │◀───────────────────┴─────────────────────┘
     │ { token, user: {...} }
     │
     │ Store in:
     │ - localStorage (token)
     │ - IndexedDB (backup)
     │
     │ Use in requests:
     │ Authorization: Bearer <token>
```

### RBAC (Role-Based Access Control)

```
┌─────────────────────────────────────────────────────────────┐
│                        ROLES                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │    admin     │   │  reception   │   │  cafeteria   │   │
│  ├──────────────┤   ├──────────────┤   ├──────────────┤   │
│  │ ✓ All access │   │ ✓ View all   │   │ ✓ Scan QR    │   │
│  │ ✓ Manage     │   │ ✓ Emit       │   │ ✓ Validate   │   │
│  │   users      │   │   vouchers   │   │ ✓ Redeem     │   │
│  │ ✓ Reports    │   │ ✓ Reports    │   │ ✓ Sync       │   │
│  │ ✓ Settings   │   │ ✓ View stays │   │ ✓ View own   │   │
│  │              │   │              │   │   reports    │   │
│  └──────────────┘   └──────────────┘   └──────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

IMPLEMENTACIÓN:
- JWT payload: { user_id, username, role, cafeteria_id }
- Middleware: requireRole(['admin', 'reception'])
- Route protection: authMiddleware + requireRole
- Frontend: conditional rendering based on role
```

### HMAC Signing (Anti-Tampering)

```
┌─────────────────────────────────────────────────────────────┐
│              VOUCHER INTEGRITY PROTECTION                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Data: code|valid_from|valid_until|stay_id                 │
│  Example: "HPN-2025-0001|2025-01-15|2025-01-17|123"        │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  HMAC-SHA256(data, VOUCHER_SECRET)                │    │
│  └────────────────────────────────────────────────────┘    │
│                        │                                    │
│                        ▼                                    │
│  Signature: a1b2c3d4e5f6...  (64 hex chars)               │
│                                                             │
│  QR Code Content: code|signature|valid_until               │
│                                                             │
│  VERIFICATION (timing-safe):                               │
│  1. Parse QR data                                          │
│  2. Fetch voucher from DB (get stay_id, dates)             │
│  3. Regenerate HMAC with same data                         │
│  4. crypto.timingSafeEqual(expected, received)             │
│  5. If match → Valid, If not → Tampered                    │
│                                                             │
│  SECURITY:                                                  │
│  ✓ 32-byte random secret (env var)                         │
│  ✓ SHA-256 algorithm                                       │
│  ✓ Timing-safe comparison                                  │
│  ✓ No exposure in logs                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 MODELO DE DATOS DETALLADO

### Tabla: users
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,  -- bcrypt
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'reception', 'cafeteria')),
  cafeteria_id INTEGER,  -- NULL para admin/reception
  is_active BOOLEAN NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  
  FOREIGN KEY (cafeteria_id) REFERENCES cafeterias(id) ON DELETE SET NULL,
  
  INDEX idx_users_username ON users(username),
  INDEX idx_users_role ON users(role)
);
```

### Tabla: cafeterias
```sql
CREATE TABLE cafeterias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  
  INDEX idx_cafeterias_active ON cafeterias(is_active)
);
```

### Tabla: stays
```sql
CREATE TABLE stays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  guest_phone TEXT,
  room_number TEXT NOT NULL,
  checkin_date TEXT NOT NULL,   -- YYYY-MM-DD
  checkout_date TEXT NOT NULL,  -- YYYY-MM-DD
  number_of_guests INTEGER NOT NULL DEFAULT 1,
  breakfast_included BOOLEAN NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  
  CHECK(checkin_date <= checkout_date),
  
  INDEX idx_stays_dates ON stays(checkin_date, checkout_date),
  INDEX idx_stays_room ON stays(room_number)
);
```

### Tabla: vouchers (CORE)
```sql
CREATE TABLE vouchers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,  -- HPN-YYYY-####
  stay_id INTEGER NOT NULL,
  valid_from TEXT NOT NULL,   -- YYYY-MM-DD
  valid_until TEXT NOT NULL,  -- YYYY-MM-DD
  hmac_signature TEXT NOT NULL,  -- SHA-256 hex (64 chars)
  status TEXT NOT NULL DEFAULT 'active' 
    CHECK(status IN ('active', 'redeemed', 'expired', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  
  FOREIGN KEY (stay_id) REFERENCES stays(id) ON DELETE CASCADE,
  
  CHECK(valid_from <= valid_until),
  
  INDEX idx_vouchers_code ON vouchers(code),
  INDEX idx_vouchers_stay ON vouchers(stay_id),
  INDEX idx_vouchers_status ON vouchers(status),
  INDEX idx_vouchers_dates ON vouchers(valid_from, valid_until)
);
```

### Tabla: redemptions (CRITICAL - ATOMIC)
```sql
CREATE TABLE redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id INTEGER NOT NULL UNIQUE,  -- ◄── PREVIENE DUPLICADOS
  cafeteria_id INTEGER NOT NULL,
  device_id TEXT NOT NULL,  -- Para tracking offline
  redeemed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  redeemed_by INTEGER NOT NULL,  -- user_id
  correlation_id TEXT,  -- Para tracking distribuido
  notes TEXT,
  
  FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
  FOREIGN KEY (cafeteria_id) REFERENCES cafeterias(id) ON DELETE RESTRICT,
  FOREIGN KEY (redeemed_by) REFERENCES users(id) ON DELETE RESTRICT,
  
  INDEX idx_redemptions_voucher ON redemptions(voucher_id),
  INDEX idx_redemptions_cafeteria ON redemptions(cafeteria_id),
  INDEX idx_redemptions_device ON redemptions(device_id),
  INDEX idx_redemptions_date ON redemptions(redeemed_at),
  INDEX idx_redemptions_correlation ON redemptions(correlation_id)
);

-- CRITICAL: UNIQUE constraint es la clave para atomicidad
-- Si dos requests intentan canjear el mismo voucher:
-- 1. Primer INSERT → Success
-- 2. Segundo INSERT → SQLITE_CONSTRAINT_UNIQUE error
-- 3. Catch error → Return "ALREADY_REDEEMED"
```

### Tabla: sync_log (AUDITORÍA)
```sql
CREATE TABLE sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('redemption', 'conflict', 'metrics')),
  payload TEXT,  -- JSON con detalles
  result TEXT NOT NULL CHECK(result IN ('success', 'error', 'conflict')),
  error_message TEXT,
  synced_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  
  INDEX idx_sync_log_device ON sync_log(device_id),
  INDEX idx_sync_log_date ON sync_log(synced_at),
  INDEX idx_sync_log_result ON sync_log(result)
);
```

---

## 🧪 CASOS DE PRUEBA CRÍTICOS

### Test Case #1: Emisión de Vouchers
```javascript
✓ Emitir N vouchers para una estadía
✓ Códigos únicos y secuenciales
✓ HMAC correcto para cada voucher
✓ QR genera correctamente
✓ Fechas válidas (dentro de estadía)
✓ Transacción atómica (all or nothing)
```

### Test Case #5: Canje Atómico
```javascript
✓ Canje exitoso actualiza voucher y crea redemption
✓ UNIQUE constraint previene doble canje
✓ Transaction rollback en error
✓ Logs de auditoría completos
```

### Test Case #7: Sincronización Offline
```javascript
✓ Canjes se guardan en IndexedDB
✓ Background sync dispara automáticamente
✓ Canjes se envían en batch
✓ Responses procesan correctamente
✓ Synced items se eliminan de IndexedDB
✓ Conflictos se preservan para resolución
```

### Test Case #10: Reconciliación CSV (CRÍTICO)
```javascript
describe('CSV Report - Online + Offline Redemptions', () => {
  it('should include 7 rows: 3 online + 4 offline', async () => {
    // Setup
    await emitVouchers(10);  // Emitir 10 vouchers
    
    // 3 canjes online
    await redeem('HPN-2025-0001', { device: 'online-1', cafe: 1 });
    await redeem('HPN-2025-0002', { device: 'online-1', cafe: 1 });
    await redeem('HPN-2025-0003', { device: 'online-2', cafe: 1 });
    
    // 4 canjes offline (sync después)
    await redeemOffline('HPN-2025-0004', { device: 'offline-1' });
    await redeemOffline('HPN-2025-0005', { device: 'offline-1' });
    await redeemOffline('HPN-2025-0006', { device: 'offline-2' });
    await redeemOffline('HPN-2025-0007', { device: 'offline-2' });
    await syncRedemptions();
    
    // Generate report
    const csv = await GET('/api/reports/redemptions?format=csv');
    
    // Assertions
    expect(csv.split('\n')).toHaveLength(8);  // header + 7 data
    expect(csv).toContain('device_id');
    expect(csv).toContain('cafeteria');
    expect(csv).toContain('HPN-2025-0001');
    expect(csv).toContain('HPN-2025-0007');
    expect(csv).toContain('offline-1');
    expect(csv).toContain('offline-2');
    expect(csv).not.toContain('HPN-2025-0008');  // No canjeado
  });
});
```

---

## 🔧 TECNOLOGÍAS Y VERSIONES

```yaml
Backend:
  runtime: Node.js 18+
  framework: Express.js 4.18+
  database: SQLite (better-sqlite3 9.2+)
  auth: jsonwebtoken 9.0+
  crypto: bcryptjs 2.4+
  validation: zod 3.22+
  logging: winston 3.11+
  qr: qrcode 1.5+
  security:
    - helmet 7.1+
    - cors 2.8+
    - express-rate-limit 7.1+

Frontend (PWA):
  framework: React 18+
  router: React Router 6+
  storage: idb 7+
  qr-scanner: html5-qrcode 2.3+
  http: axios 1.6+
  offline: workbox 7+
  
Testing:
  unit: Jest 29+
  integration: Supertest 6+
  e2e: Playwright 1.40+
  coverage: Istanbul (via Jest)

DevOps:
  ci-cd: GitHub Actions
  hosting: Fly.io
  containerization: Docker (multi-stage)
  monitoring: Fly.io metrics + custom logs

Tools:
  linting: ESLint 8+
  formatting: Prettier 3+
  git-hooks: Husky 8+ (opcional)
```

---

## 📈 MÉTRICAS Y KPIs

### SLIs (Service Level Indicators)
```
Availability:
  - Uptime: >99.9% (8.76h downtime/year máx)
  - Health check success rate: >99.5%

Performance:
  - API response time p50: <200ms
  - API response time p95: <500ms
  - API response time p99: <1000ms
  - PWA First Contentful Paint: <2s
  - PWA Time to Interactive: <3s

Reliability:
  - Error rate: <1% of total requests
  - Redemption success rate: >95%
  - Sync success rate: >98%
  - Database transaction success: >99.9%

Scalability:
  - Concurrent users: >50
  - Requests per second: >20
  - Database size: <1GB for 100k vouchers
```

### Business Metrics
```
Operational:
  - Vouchers emitted per day
  - Redemption rate (redeemed/emitted)
  - Average redemption time (minutes after checkin)
  - Peak redemption hours
  - Top performing cafeterias
  
Efficiency:
  - Time to reconcile reports: <5 minutes
  - Offline sync latency: <10 seconds
  - Conflict resolution time: <1 minute per conflict
  
Quality:
  - Duplicate redemption attempts: <0.1%
  - Expired voucher usage attempts: tracked
  - Invalid QR scans: tracked
  - User satisfaction: >4.5/5
```

---

## 🎨 UI/UX WIREFRAMES

### Login Screen (PWA)
```
┌─────────────────────────────────────┐
│  🏨  Hostal Playa Norte             │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 👤 Usuario                    │ │
│  │ [_________________________]   │ │
│  │                               │ │
│  │ 🔒 Contraseña                 │ │
│  │ [_________________________]   │ │
│  │                               │ │
│  │  [ 🔐 Iniciar Sesión ]        │ │
│  │                               │ │
│  │  Recuérdame  ☑️                │ │
│  └───────────────────────────────┘ │
│                                     │
│  📶 Estado: Online ✓                │
└─────────────────────────────────────┘
```

### Scanner Screen (Cafeteria Role)
```
┌─────────────────────────────────────┐
│  ← Escanear Voucher         👤 Juan │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │    📷                        │   │
│  │                             │   │
│  │    [QR Scanner Area]        │   │
│  │                             │   │
│  │    Apunte al código QR      │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  ────────── o ──────────            │
│                                     │
│  💳 Ingresar código manualmente     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Código: [_______________]   │   │
│  │                             │   │
│  │ [ Validar ]                 │   │
│  └─────────────────────────────┘   │
│                                     │
│  📊 Hoy: 12 canjes                  │
│  ⏱️  Última sincronización: 10:30   │
│  📶 Online ✓ | 0 pendientes         │
└─────────────────────────────────────┘
```

### Voucher Detail (Pre-Redeem)
```
┌─────────────────────────────────────┐
│  ← Confirmar Canje                  │
├─────────────────────────────────────┤
│                                     │
│  ✅ Voucher Válido                  │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🎫 HPN-2025-0042            │   │
│  │                             │   │
│  │ 👤 Huésped                  │   │
│  │    Juan Pérez García        │   │
│  │                             │   │
│  │ 🛏️  Habitación: 101          │   │
│  │                             │   │
│  │ 📅 Válido                    │   │
│  │    15/01/2025 - 17/01/2025  │   │
│  │                             │   │
│  │ 🍳 Desayuno incluido         │   │
│  └─────────────────────────────┘   │
│                                     │
│  [ ✓ Confirmar Canje ]              │
│  [ ✕ Cancelar ]                     │
│                                     │
└─────────────────────────────────────┘
```

### Success Screen
```
┌─────────────────────────────────────┐
│                                     │
│         ✅                           │
│                                     │
│    ¡Canje Exitoso!                  │
│                                     │
│  🎫 HPN-2025-0042                   │
│  👤 Juan Pérez García                │
│  ⏰ 15/01/2025 08:45                 │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  [ Escanear Siguiente ]     │   │
│  └─────────────────────────────┘   │
│                                     │
│  [ Ver Detalles ]                   │
│                                     │
└─────────────────────────────────────┘
```

### Sync Status (Offline Mode)
```
┌─────────────────────────────────────┐
│  ← Estado de Sincronización         │
├─────────────────────────────────────┤
│                                     │
│  📶 Modo: Offline                   │
│                                     │
│  ⏳ Canjes Pendientes: 4            │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🕐 HPN-2025-0050 - 08:30    │   │
│  │ 🕐 HPN-2025-0051 - 08:32    │   │
│  │ 🕐 HPN-2025-0052 - 08:35    │   │
│  │ 🕐 HPN-2025-0053 - 08:40    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ℹ️ Se sincronizarán automáticamente│
│     cuando haya conexión            │
│                                     │
│  [ 🔄 Reintentar Ahora ]            │
│                                     │
│  ⚠️  Conflictos: 1                  │
│  [ Ver Conflictos ]                 │
│                                     │
└─────────────────────────────────────┘
```

---

**FIN DEL BLUEPRINT ARQUITECTÓNICO**

Este documento complementa la PLANIFICACIÓN_MAESTRA_DESARROLLO.md
