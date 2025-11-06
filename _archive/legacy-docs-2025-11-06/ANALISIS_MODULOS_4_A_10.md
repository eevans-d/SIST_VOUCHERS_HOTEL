# 🔍 ANÁLISIS MÓDULOS 4-10
# Sistema de Vouchers Hotel - Continuación Auditoría

---

## MÓDULO 4: AUDITORÍA BASE DE DATOS 🗄️

### 4.1 Esquema de Base de Datos

**Motor:** SQLite 3 (better-sqlite3) con WAL mode

**Tablas (9):**

```sql
1. users (usuarios del sistema)
2. stays (estadías de huéspedes)
3. vouchers (comprobantes de desayuno)
4. orders (órdenes de cafetería)
5. order_items (items de órdenes - M:N)
6. order_vouchers (relación orden-vouchers - M:N)
7. menu_items (productos disponibles)
8. refresh_tokens (tokens JWT)
9. audit_logs (opcional - no confirmado)
```

### 4.2 Análisis de Schema

#### **Tabla `users`:**

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,  -- ⚠️ bcrypt hash
  role TEXT NOT NULL DEFAULT 'guest',
  isActive INTEGER NOT NULL DEFAULT 1,
  lastLogin TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

**✅ Fortalezas:**
- UUID como PK (distribución uniforme)
- Email único (UNIQUE constraint)
- Índices en campos frecuentes

**🔴 Problemas:**

1. **Password en misma tabla:**
   ```sql
   -- ❌ PROBLEMA: Password junto a datos de perfil
   SELECT * FROM users WHERE id = ?;
   -- Retorna password hash innecesariamente
   
   -- ✅ MEJOR: Separar tabla credentials
   CREATE TABLE user_credentials (
     user_id TEXT PRIMARY KEY REFERENCES users(id),
     password_hash TEXT NOT NULL,
     salt TEXT,
     updated_at TEXT NOT NULL
   );
   ```

2. **Falta soft delete mejorado:**
   ```sql
   -- ACTUAL: isActive = 0|1
   isActive INTEGER NOT NULL DEFAULT 1
   
   -- MEJOR: deleted_at timestamp
   deleted_at TEXT DEFAULT NULL
   ```

3. **Falta audit fields:**
   ```sql
   -- FALTA:
   created_by TEXT REFERENCES users(id),
   updated_by TEXT REFERENCES users(id)
   ```

---

#### **Tabla `stays`:**

```sql
CREATE TABLE stays (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id),
  hotelCode TEXT NOT NULL,
  roomNumber TEXT NOT NULL,
  checkIn TEXT NOT NULL,
  checkOut TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX idx_stays_userId ON stays(userId);
CREATE INDEX idx_stays_hotelCode ON stays(hotelCode);
CREATE INDEX idx_stays_status ON stays(status);
```

**🔴 Problemas:**

1. **Sin índice compuesto para queries frecuentes:**
   ```sql
   -- QUERY FRECUENTE:
   SELECT * FROM stays 
   WHERE hotelCode = 'H001' 
     AND status = 'active' 
     AND checkIn >= '2025-01-01'
   ORDER BY checkIn DESC;
   
   -- ❌ ACTUAL: 3 índices simples (no óptimo)
   -- ✅ AGREGAR:
   CREATE INDEX idx_stays_hotel_status_checkin 
     ON stays(hotelCode, status, checkIn DESC);
   ```

2. **Falta validación de fechas:**
   ```sql
   -- ❌ FALTA: checkOut > checkIn
   -- SQLite no soporta CHECK constraints complejas
   -- Validar en application layer
   ```

3. **Sin partitioning:**
   ```sql
   -- ⚠️ PROBLEMA: Tabla crece indefinidamente
   -- Si hay 1M+ stays → queries lentas
   
   -- SOLUCIÓN: Particionar por año (PostgreSQL)
   CREATE TABLE stays_2025 PARTITION OF stays
     FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
   ```

---

#### **Tabla `vouchers`:**

```sql
CREATE TABLE vouchers (
  id TEXT PRIMARY KEY,
  stayId TEXT NOT NULL REFERENCES stays(id),
  code TEXT NOT NULL UNIQUE,
  qrCode TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  redemptionDate TEXT,
  redemptionNotes TEXT,
  expiryDate TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_vouchers_code ON vouchers(code);
CREATE INDEX idx_vouchers_stayId ON vouchers(stayId);
CREATE INDEX idx_vouchers_status ON vouchers(status);
```

**✅ Fortalezas:**
- Código único (UNIQUE index)
- FK constraint a stays

**🔴 Problemas:**

1. **Sin índice en expiryDate:**
   ```sql
   -- QUERY FRECUENTE (job de limpieza):
   SELECT * FROM vouchers 
   WHERE status = 'active' 
     AND expiryDate < datetime('now');
   
   -- ❌ FALTA:
   CREATE INDEX idx_vouchers_status_expiry 
     ON vouchers(status, expiryDate);
   ```

2. **qrCode almacenado (duplicación):**
   ```sql
   -- ❌ PROBLEMA: QR generado en backend y almacenado
   qrCode TEXT -- URL de Google Charts
   
   -- ✅ MEJOR: Generar dinámicamente
   -- No almacenar, calcular on-the-fly desde `code`
   ```

3. **Falta índice en redemptionDate:**
   ```sql
   -- QUERY FRECUENTE (reportes):
   SELECT * FROM vouchers 
   WHERE redemptionDate BETWEEN ? AND ?;
   
   -- ❌ FALTA:
   CREATE INDEX idx_vouchers_redemption 
     ON vouchers(redemptionDate);
   ```

---

#### **Tabla `orders`:**

```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  stayId TEXT NOT NULL REFERENCES stays(id),
  status TEXT NOT NULL DEFAULT 'open',
  total REAL NOT NULL DEFAULT 0,
  discountAmount REAL NOT NULL DEFAULT 0,
  finalTotal REAL NOT NULL DEFAULT 0,
  notes TEXT,
  createdAt TEXT NOT NULL,
  completedAt TEXT,
  updatedAt TEXT NOT NULL
);

CREATE INDEX idx_orders_stayId ON orders(stayId);
CREATE INDEX idx_orders_status ON orders(status);
```

**🔴 Problemas:**

1. **Sin índice en completedAt:**
   ```sql
   -- QUERY FRECUENTE (reportes diarios):
   SELECT * FROM orders 
   WHERE status = 'completed' 
     AND completedAt BETWEEN ? AND ?;
   
   -- ❌ FALTA:
   CREATE INDEX idx_orders_completed 
     ON orders(status, completedAt);
   ```

2. **Totales almacenados (desnormalización):**
   ```sql
   -- ❌ RIESGO: Inconsistencia
   total REAL NOT NULL DEFAULT 0,
   discountAmount REAL NOT NULL DEFAULT 0,
   finalTotal REAL NOT NULL DEFAULT 0,
   
   -- Si se actualizan items pero no totales → datos corruptos
   
   -- OPCIÓN 1: Calcular siempre (normalizado)
   -- OPCIÓN 2: Trigger para actualizar (SQLite soporta)
   CREATE TRIGGER update_order_totals
   AFTER INSERT ON order_items
   FOR EACH ROW
   BEGIN
     UPDATE orders
     SET total = (SELECT SUM(subtotal) FROM order_items WHERE orderId = NEW.orderId)
     WHERE id = NEW.orderId;
   END;
   ```

3. **Sin índice compuesto para analytics:**
   ```sql
   -- QUERY ANALYTICS:
   SELECT DATE(createdAt), SUM(finalTotal)
   FROM orders
   WHERE status = 'completed'
   GROUP BY DATE(createdAt);
   
   -- OPTIMIZAR:
   CREATE INDEX idx_orders_status_created 
     ON orders(status, createdAt);
   ```

---

#### **Tabla `order_items` (M:N):**

```sql
CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  productCode TEXT NOT NULL,
  productName TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unitPrice REAL NOT NULL,
  subtotal REAL NOT NULL
);

CREATE INDEX idx_order_items_orderId ON order_items(orderId);
```

**🔴 Problemas:**

1. **productCode sin FK:**
   ```sql
   -- ❌ PROBLEMA: No hay relación con menu_items
   productCode TEXT NOT NULL,
   productName TEXT NOT NULL, -- Duplicación
   
   -- ✅ MEJOR: FK a menu_items
   menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
   -- productName se obtiene de JOIN
   ```

2. **Subtotal calculado (desnormalización):**
   ```sql
   -- ❌ RIESGO: quantity * unitPrice != subtotal
   subtotal REAL NOT NULL
   
   -- OPCIÓN 1: Calcular en query
   SELECT quantity * unitPrice as subtotal ...
   
   -- OPCIÓN 2: Trigger
   CREATE TRIGGER calculate_subtotal
   BEFORE INSERT ON order_items
   FOR EACH ROW
   BEGIN
     UPDATE order_items
     SET subtotal = NEW.quantity * NEW.unitPrice
     WHERE id = NEW.id;
   END;
   ```

3. **Sin índice en productCode:**
   ```sql
   -- QUERY FRECUENTE (top productos):
   SELECT productCode, SUM(quantity)
   FROM order_items
   GROUP BY productCode;
   
   -- ❌ FALTA:
   CREATE INDEX idx_order_items_product 
     ON order_items(productCode);
   ```

---

### 4.3 Integridad Referencial

**✅ Foreign Keys Habilitadas:**

```javascript
// better-sqlite3 config
db.pragma('foreign_keys = ON');
```

**Cascadas Configuradas:**

```sql
-- ✅ CORRECTO:
orderId TEXT REFERENCES orders(id) ON DELETE CASCADE

-- ⚠️ FALTA configurar en otras tablas:
stayId TEXT REFERENCES stays(id) ON DELETE RESTRICT
userId TEXT REFERENCES users(id) ON DELETE RESTRICT
```

**Problema: Sin Soft Deletes:**

```sql
-- ❌ ACTUAL: DELETE físico
DELETE FROM users WHERE id = ?;
-- Rompe FKs, pierde datos

-- ✅ MEJOR: Soft delete
UPDATE users SET deleted_at = datetime('now') WHERE id = ?;
```

---

### 4.4 Normalización

**Análisis de Formas Normales:**

**1NF (Primera Forma Normal):** ✅ CUMPLE
- No hay grupos repetidos
- Cada columna contiene valores atómicos

**2NF (Segunda Forma Normal):** ✅ CUMPLE
- No hay dependencias parciales (PKs son UUIDs simples)

**3NF (Tercera Forma Normal):** ⚠️ PARCIAL

```sql
-- ❌ VIOLACIÓN en order_items:
productCode TEXT,
productName TEXT,  -- Depende de productCode, no de PK
unitPrice REAL,    -- Depende de productCode, no de PK

-- DEBERÍA SER:
menu_item_id TEXT REFERENCES menu_items(id)
-- productName y unitPrice se obtienen de menu_items

-- ❌ VIOLACIÓN en orders:
total REAL,
discountAmount REAL,
finalTotal REAL  -- Calculable desde items
```

**BCNF (Boyce-Codd):** ⚠️ PARCIAL

**4NF (Cuarta Forma Normal):** ✅ CUMPLE (no hay dependencias multivalor)

---

### 4.5 Performance de Queries

**Análisis con EXPLAIN QUERY PLAN:**

```sql
-- QUERY LENTA:
EXPLAIN QUERY PLAN
SELECT v.*, s.*, u.*
FROM vouchers v
JOIN stays s ON v.stayId = s.id
JOIN users u ON s.userId = u.id
WHERE v.code = 'VOC-ABC-1234';

-- RESULTADO:
-- SEARCH vouchers USING INDEX idx_vouchers_code
-- SEARCH stays USING INTEGER PRIMARY KEY
-- SEARCH users USING INTEGER PRIMARY KEY
-- ✅ Bien optimizado (usa índices)

-- QUERY LENTA:
EXPLAIN QUERY PLAN
SELECT * FROM orders
WHERE status = 'completed'
  AND DATE(completedAt) = '2025-01-15';

-- RESULTADO:
-- SEARCH orders USING INDEX idx_orders_status (status=?)
-- USE TEMP B-TREE FOR ORDER BY
-- ⚠️ Problema: DATE() impide uso de índice en completedAt
-- SOLUCIÓN: Comparar rangos
WHERE status = 'completed'
  AND completedAt >= '2025-01-15 00:00:00'
  AND completedAt < '2025-01-16 00:00:00';
```

**Queries N+1 Detectadas:**

```javascript
// ❌ PROBLEMA: N+1 en reportes
const orders = await db.prepare('SELECT * FROM orders').all();
for (const order of orders) {
  // 1 query por orden
  const items = await db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(order.id);
}

// ✅ SOLUCIÓN: JOIN único
const ordersWithItems = await db.prepare(`
  SELECT o.*, 
         json_group_array(json_object(
           'id', oi.id,
           'productName', oi.productName,
           'quantity', oi.quantity
         )) as items
  FROM orders o
  LEFT JOIN order_items oi ON o.id = oi.orderId
  GROUP BY o.id
`).all();
```

---

### 4.6 Transacciones y Concurrencia

**SQLite WAL Mode:** ✅ Habilitado

```javascript
db.pragma('journal_mode = WAL');
```

**Beneficios:**
- Lecturas concurrentes (múltiples readers)
- 1 writer a la vez
- Performance mejorada

**Limitaciones:**

```
❌ No soporta múltiples escritores concurrentes
❌ No soporta sharding
❌ No soporta replicación master-slave
❌ Límite ~1TB tamaño DB
⚠️ Escrituras bloqueantes
```

**Deadlocks Potenciales:**

```javascript
// ❌ RIESGO: Transaction anidada
const transaction1 = db.transaction(() => {
  db.prepare('UPDATE orders SET status = ?').run('completed');
  
  // Otra transacción intentando UPDATE vouchers
  // → DEADLOCK
  const transaction2 = db.transaction(() => {
    db.prepare('UPDATE vouchers SET status = ?').run('redeemed');
  });
  transaction2();
});
```

**SOLUCIÓN: Transacciones bien definidas**

```javascript
// ✅ CORRECTO: Transaction única
const completeOrder = db.transaction((orderId, voucherId) => {
  db.prepare('UPDATE orders SET status = ?').run('completed');
  db.prepare('UPDATE vouchers SET status = ?').run('redeemed');
  db.prepare('INSERT INTO order_vouchers ...').run(...);
});

completeOrder(orderId, voucherId);
```

---

### 4.7 Backup y Disaster Recovery

**Estrategia Actual:**

```bash
# Script: backup-db.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp db/vouchers.db backups/vouchers_${DATE}.db
```

**🔴 Problemas:**

1. **Backup en caliente sin VACUUM:**
   ```bash
   # ❌ PROBLEMA: Backup con WAL activo
   cp db/vouchers.db backup.db
   # Falta copiar vouchers.db-wal y vouchers.db-shm
   
   # ✅ MEJOR:
   sqlite3 db/vouchers.db ".backup backups/backup_${DATE}.db"
   ```

2. **Sin verificación de backup:**
   ```bash
   # ❌ FALTA: Validar integridad
   
   # ✅ AGREGAR:
   sqlite3 backups/backup.db "PRAGMA integrity_check;"
   ```

3. **Sin rotación de backups:**
   ```bash
   # ❌ PROBLEMA: Backups se acumulan
   
   # ✅ AGREGAR:
   find backups/ -name "*.db" -mtime +30 -delete  # Borrar > 30 días
   ```

4. **Sin backup offsite:**
   ```bash
   # ❌ FALTA: Backup remoto
   
   # ✅ AGREGAR:
   aws s3 sync backups/ s3://hotel-vouchers-backups/
   ```

---

### 4.8 Migraciones

**Estrategia Actual:**

```javascript
// scripts/migrate.js
const migrations = [
  '001_initial_schema.sql',
  '002_add_refresh_tokens.sql',
  '003_add_order_vouchers.sql'
];

migrations.forEach(file => {
  const sql = fs.readFileSync(file, 'utf8');
  db.exec(sql);
});
```

**🔴 Problemas:**

1. **Sin control de versiones:**
   ```sql
   -- ❌ FALTA: Tabla de migraciones
   
   -- ✅ CREAR:
   CREATE TABLE schema_migrations (
     version TEXT PRIMARY KEY,
     applied_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   
   -- Solo aplicar si no existe:
   INSERT OR IGNORE INTO schema_migrations (version) 
   VALUES ('002_add_refresh_tokens');
   ```

2. **Sin rollback:**
   ```javascript
   // ❌ FALTA: down migrations
   
   // ✅ ESTRUCTURA:
   migrations/
     001_initial/
       up.sql
       down.sql
     002_add_tokens/
       up.sql
       down.sql
   ```

3. **Sin testing de migraciones:**
   ```javascript
   // ❌ FALTA: Test en DB clone
   
   // ✅ AGREGAR:
   beforeEach(() => {
     cp vouchers.db test_vouchers.db
     runMigrations(testDb)
   });
   ```

---

## RESUMEN MÓDULO 4: BASE DE DATOS

### 🎯 Puntaje General: 6/10

| Aspecto | Puntaje | Estado |
|---------|---------|--------|
| Esquema | 7/10 | ⚠️ Mejorable |
| Normalización | 6/10 | ⚠️ Mejorable |
| Índices | 5/10 | 🔴 Deficiente |
| Integridad | 7/10 | ⚠️ Mejorable |
| Performance | 6/10 | ⚠️ Mejorable |
| Backups | 4/10 | 🔴 Deficiente |

### 🚨 ISSUES CRÍTICOS (P0):

1. ❌ **Falta índices compuestos** (queries lentas)
2. ❌ **Sin backup offsite** (riesgo pérdida datos)
3. ❌ **Totales desnormalizados** (riesgo inconsistencia)
4. ❌ **Sin soft deletes** (pérdida de datos)
5. ❌ **SQLite límites escalabilidad** (no horizontal scaling)

### ⚠️ ISSUES IMPORTANTES (P1):

6. ⚠️ Password en tabla users (debería ser separada)
7. ⚠️ productName duplicado en order_items
8. ⚠️ Sin verificación de backups
9. ⚠️ Sin rollback en migraciones
10. ⚠️ N+1 queries en reportes

### 📋 ACCIONES RECOMENDADAS:

**Inmediato (Sprint 1):**
1. Crear índices compuestos (hotel+status+date)
2. Implementar backup offsite (S3)
3. Agregar PRAGMA integrity_check en backups
4. Crear tabla schema_migrations

**Corto Plazo (Sprint 2-3):**
5. Implementar soft deletes (deleted_at)
6. Crear triggers para totales
7. Normalizar order_items (FK a menu_items)
8. Optimizar queries N+1 con JOINs

**Mediano Plazo (Sprint 4-6):**
9. Migrar a PostgreSQL (escalabilidad)
10. Implementar replicación master-slave
11. Agregar partitioning por año
12. Implementar CDC (Change Data Capture)

---

## MÓDULO 5: ANÁLISIS DE SEGURIDAD 🔒

### 5.1 Autenticación

**Implementación Actual:**

```javascript
// JWT con access + refresh tokens
const accessToken = jwt.sign({ userId, role }, SECRET, { expiresIn: '15m' });
const refreshToken = jwt.sign({ userId }, REFRESH_SECRET, { expiresIn: '7d' });
```

**✅ Fortalezas:**
- Doble token (access + refresh)
- Expiración corta en access token (15 min)
- Bcrypt con 10 rounds

**🔴 Vulnerabilidades:**

1. **JWT Secret en ENV:**
   ```javascript
   // ❌ RIESGO: Secret hardcodeado
   JWT_SECRET=mysecretkey123
   REFRESH_SECRET=myrefreshsecret456
   
   // ✅ MEJOR: AWS Secrets Manager
   const secret = await secretsManager.getSecretValue({ SecretId: 'jwt-secret' });
   ```

2. **Sin Rotación de Secrets:**
   ```javascript
   // ❌ PROBLEMA: Secret nunca cambia
   // Si se compromete → todos los tokens inválidos
   
   // ✅ MEJOR: Rotación automática
   // Múltiples secrets activos simultáneamente
   const secrets = [
     { version: 2, secret: 'new_secret', validUntil: '2025-02-01' },
     { version: 1, secret: 'old_secret', validUntil: '2025-01-15' }
   ];
   ```

3. **Sin Blacklist de Tokens:**
   ```javascript
   // ❌ PROBLEMA: Token robado válido hasta expiración
   // No hay forma de invalidar token antes de tiempo
   
   // ✅ MEJOR: Redis blacklist
   const blacklist = new Set();
   
   function isBlacklisted(token) {
     return blacklist.has(token);
   }
   
   // Al logout:
   blacklist.add(token);
   redis.setex(`blacklist:${token}`, 900, '1'); // 15min TTL
   ```

4. **Sin IP Binding:**
   ```javascript
   // ❌ RIESGO: Token usado desde otra IP
   const payload = { userId, role };
   
   // ✅ MEJOR: Bind a IP
   const payload = { userId, role, ip: req.ip };
   
   // Validar en cada request:
   if (payload.ip !== req.ip) {
     throw new Error('IP mismatch');
   }
   ```

5. **Sin Device Fingerprinting:**
   ```javascript
   // ❌ FALTA: Detectar múltiples dispositivos
   
   // ✅ AGREGAR: User-Agent + browser fingerprint
   const fingerprint = createHash('sha256')
     .update(req.headers['user-agent'])
     .update(req.headers['accept-language'])
     .digest('hex');
   ```

---

### 5.2 Autorización (RBAC)

**Implementación Actual:**

```javascript
// Roles: admin, manager, staff, guest
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// Uso:
router.get('/reports', authorize('admin', 'manager'), getReports);
```

**✅ Fortalezas:**
- Middleware reutilizable
- Múltiples roles permitidos

**🔴 Problemas:**

1. **RBAC Básico (sin permisos granulares):**
   ```javascript
   // ❌ ACTUAL: Solo roles
   authorize('admin', 'manager')
   
   // ✅ MEJOR: Permisos específicos
   authorize('reports:read', 'reports:export')
   
   // Tabla permissions:
   // admin → reports:*, vouchers:*, orders:*
   // manager → reports:read, vouchers:*, orders:read
   // staff → vouchers:redeem, orders:create
   ```

2. **Sin Resource-Based Access Control:**
   ```javascript
   // ❌ PROBLEMA: Manager puede ver reportes de todos los hoteles
   router.get('/reports/:hotelCode', authorize('manager'), getReports);
   
   // ✅ MEJOR: Validar ownership
   if (req.user.hotelCode !== req.params.hotelCode) {
     throw new ForbiddenError();
   }
   ```

3. **Sin Attribute-Based Access Control (ABAC):**
   ```javascript
   // ❌ ACTUAL: Solo rol
   if (user.role === 'manager') { ... }
   
   // ✅ MEJOR: Múltiples atributos
   const policy = {
     effect: 'Allow',
     actions: ['reports:read'],
     resources: ['reports/*'],
     conditions: {
       'hotelCode': user.hotelCode,
       'time': { after: '08:00', before: '20:00' }
     }
   };
   ```

---

### 5.3 Validación de Entrada

**Implementación Actual:**

```javascript
// Zod schemas
const VoucherSchema = z.object({
  stayId: z.string().uuid(),
  code: z.string().regex(/^[A-Z0-9-]+$/)
});
```

**✅ Fortalezas:**
- Zod para validación tipada
- Regex para formato de código

**🔴 Vulnerabilidades:**

1. **SQL Injection Parcial:**
   ```javascript
   // ❌ VULNERABLE: String interpolation
   const hotelCode = req.params.hotelCode;
   const sql = `SELECT * FROM stays WHERE hotelCode = '${hotelCode}'`;
   db.prepare(sql).all();
   
   // Payload malicioso: hotelCode = "H001' OR '1'='1"
   
   // ✅ SEGURO: Prepared statements
   const sql = 'SELECT * FROM stays WHERE hotelCode = ?';
   db.prepare(sql).all(hotelCode);
   ```

2. **XSS en Notas:**
   ```javascript
   // ❌ VULNERABLE: HTML sin sanitizar
   order.notes = req.body.notes; // "<script>alert('XSS')</script>"
   
   // ✅ SEGURO: Sanitizar HTML
   import DOMPurify from 'isomorphic-dompurify';
   order.notes = DOMPurify.sanitize(req.body.notes);
   ```

3. **File Upload Sin Validación:**
   ```javascript
   // ❌ VULNERABLE: Subir cualquier archivo
   upload.single('qrCode')
   
   // ✅ SEGURO: Validar tipo y tamaño
   const upload = multer({
     limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
     fileFilter: (req, file, cb) => {
       if (!file.mimetype.startsWith('image/')) {
         return cb(new Error('Solo imágenes'));
       }
       cb(null, true);
     }
   });
   ```

4. **Sin Rate Limiting:**
   ```javascript
   // ❌ VULNERABLE: Brute force en login
   app.post('/api/auth/login', loginHandler);
   
   // ✅ SEGURO: Rate limit
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 min
     max: 5, // 5 intentos
     message: 'Demasiados intentos, espera 15 minutos'
   });
   
   app.post('/api/auth/login', limiter, loginHandler);
   ```

5. **Sin CAPTCHA:**
   ```javascript
   // ❌ FALTA: Protección contra bots
   
   // ✅ AGREGAR: reCAPTCHA v3
   const { recaptchaToken } = req.body;
   const recaptchaResponse = await axios.post(
     'https://www.google.com/recaptcha/api/siteverify',
     { secret: RECAPTCHA_SECRET, response: recaptchaToken }
   );
   
   if (recaptchaResponse.data.score < 0.5) {
     throw new Error('Verificación fallida');
   }
   ```

---

### 5.4 Criptografía

**Implementación Actual:**

```javascript
// Bcrypt para passwords
const hash = bcrypt.hashSync(password, 10);

// JWT para tokens
const token = jwt.sign(payload, secret);
```

**✅ Fortalezas:**
- Bcrypt con salt automático
- 10 rounds (seguro)

**🔴 Problemas:**

1. **Sin Encriptación de Datos Sensibles:**
   ```javascript
   // ❌ PROBLEMA: Email en texto plano
   INSERT INTO users (email) VALUES ('user@example.com');
   
   // ✅ MEJOR: Encriptar PII
   const crypto = require('crypto');
   const algorithm = 'aes-256-gcm';
   
   function encrypt(text, key) {
     const iv = crypto.randomBytes(16);
     const cipher = crypto.createCipheriv(algorithm, key, iv);
     let encrypted = cipher.update(text, 'utf8', 'hex');
     encrypted += cipher.final('hex');
     const authTag = cipher.getAuthTag();
     return { encrypted, iv: iv.toString('hex'), authTag: authTag.toString('hex') };
   }
   ```

2. **Sin HTTPS Enforcement:**
   ```javascript
   // ❌ FALTA: Redirect HTTP → HTTPS
   
   // ✅ AGREGAR:
   if (process.env.NODE_ENV === 'production') {
     app.use((req, res, next) => {
       if (req.header('x-forwarded-proto') !== 'https') {
         return res.redirect(`https://${req.hostname}${req.url}`);
       }
       next();
     });
   }
   ```

3. **Sin HSTS Header:**
   ```javascript
   // ❌ FALTA: Strict-Transport-Security
   
   // ✅ AGREGAR (con Helmet):
   app.use(helmet.hsts({
     maxAge: 31536000,  // 1 año
     includeSubDomains: true,
     preload: true
   }));
   ```

4. **JWT Sin Algoritmo Explícito:**
   ```javascript
   // ⚠️ RIESGO: Algorithm confusion attack
   jwt.verify(token, secret);
   
   // ✅ SEGURO: Especificar algoritmo
   jwt.verify(token, secret, { algorithms: ['HS256'] });
   ```

---

### 5.5 OWASP Top 10 (2021)

**A01:2021 - Broken Access Control**
- 🔴 **VULNERABLE:** Sin validación de ownership en recursos
- 🔴 **VULNERABLE:** RBAC sin permisos granulares

**A02:2021 - Cryptographic Failures**
- ⚠️ **PARCIAL:** Passwords hasheados, pero PII en texto plano
- 🔴 **VULNERABLE:** Sin HTTPS enforcement

**A03:2021 - Injection**
- ⚠️ **PARCIAL:** Prepared statements usados, pero hay string interpolation

**A04:2021 - Insecure Design**
- ⚠️ **PARCIAL:** Sin threat modeling documentado
- 🔴 **VULNERABLE:** Sin defense in depth

**A05:2021 - Security Misconfiguration**
- ⚠️ **PARCIAL:** Helmet parcialmente configurado
- 🔴 **VULNERABLE:** CORS muy permisivo

**A06:2021 - Vulnerable Components**
- ✅ **SEGURO:** Dependencias actualizadas
- ⚠️ **MEJORABLE:** Sin Snyk/Dependabot

**A07:2021 - Authentication Failures**
- ⚠️ **PARCIAL:** JWT implementado, pero sin MFA
- 🔴 **VULNERABLE:** Sin rate limiting en login

**A08:2021 - Software Integrity Failures**
- ⚠️ **PARCIAL:** Sin SRI (Subresource Integrity)
- ⚠️ **PARCIAL:** Sin firma digital en releases

**A09:2021 - Logging Failures**
- ⚠️ **PARCIAL:** Winston logger, pero sin SIEM integration
- 🔴 **VULNERABLE:** Logs con datos sensibles

**A10:2021 - Server-Side Request Forgery (SSRF)**
- ✅ **NO APLICA:** No hay fetching de URLs de usuario

**Score OWASP:** 5.5/10 ⚠️

---

### 5.6 Recomendaciones de Seguridad

**Nivel P0 (Crítico - Sprint 1):**

1. ✅ **Implementar Rate Limiting**
   ```bash
   npm install express-rate-limit
   ```

2. ✅ **HTTPS Enforcement**
   ```javascript
   app.use(helmet());
   app.use(forceHTTPS);
   ```

3. ✅ **Sanitizar Inputs**
   ```bash
   npm install dompurify isomorphic-dompurify
   ```

4. ✅ **Validar Ownership en Recursos**
   ```javascript
   if (resource.userId !== req.user.id) {
     throw new ForbiddenError();
   }
   ```

**Nivel P1 (Importante - Sprint 2-3):**

5. ✅ **Token Blacklist (Redis)**
   ```bash
   npm install redis
   ```

6. ✅ **Secrets Rotation**
   ```javascript
   // AWS Secrets Manager o Vault
   ```

7. ✅ **MFA (Multi-Factor Authentication)**
   ```bash
   npm install speakeasy qrcode
   ```

8. ✅ **Audit Logging**
   ```javascript
   logger.info('User login', { userId, ip: req.ip, timestamp });
   ```

**Nivel P2 (Mediano - Sprint 4-6):**

9. ✅ **WAF (Web Application Firewall)**
   ```
   Cloudflare, AWS WAF, o ModSecurity
   ```

10. ✅ **Penetration Testing**
    ```
    OWASP ZAP, Burp Suite
    ```

11. ✅ **Bug Bounty Program**
    ```
    HackerOne, Bugcrowd
    ```

12. ✅ **Security Headers**
    ```javascript
    app.use(helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      }
    }));
    ```

---

## RESUMEN MÓDULO 5: SEGURIDAD

### 🎯 Puntaje General: 5.5/10

| Aspecto | Puntaje | Estado |
|---------|---------|--------|
| Autenticación | 6/10 | ⚠️ Mejorable |
| Autorización | 5/10 | 🔴 Deficiente |
| Validación | 6/10 | ⚠️ Mejorable |
| Criptografía | 6/10 | ⚠️ Mejorable |
| OWASP Top 10 | 5.5/10 | 🔴 Deficiente |

### 🚨 ISSUES CRÍTICOS (P0):

1. ❌ **Sin rate limiting** (vulnerable a brute force)
2. ❌ **Sin HTTPS enforcement** (man-in-the-middle)
3. ❌ **Sin validación ownership** (acceso no autorizado)
4. ❌ **Secrets hardcodeados** (riesgo compromiso)
5. ❌ **Sin token blacklist** (tokens robados válidos)

### ⚠️ ISSUES IMPORTANTES (P1):

6. ⚠️ Sin MFA (autenticación débil)
7. ⚠️ RBAC sin permisos granulares
8. ⚠️ PII sin encriptar (GDPR/CCPA risk)
9. ⚠️ Logs con datos sensibles
10. ⚠️ Sin audit trail completo

---

**FIN MÓDULO 5**

*Continuación en siguiente sección...*

