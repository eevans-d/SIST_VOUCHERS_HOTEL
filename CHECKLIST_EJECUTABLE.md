# ☑️ CHECKLIST EJECUTABLE - DESARROLLO COMPLETO
## Sistema Vouchers Digitales - Tracking de Progreso

**Fecha Inicio:** _____________  
**Fecha Objetivo:** _____________  
**Desarrollador(es):** _____________

---

## 📊 PROGRESO GENERAL

```
Total Tareas: 170
Completadas: 0
En Progreso: 0
Pendientes: 170

Progreso: [░░░░░░░░░░░░░░░░░░░░] 0%
```

---

## 🎯 MÓDULO 0: PREPARACIÓN DEL ENTORNO
**Estado:** ⏸️ Pendiente | **Prioridad:** 🔴 CRÍTICA | **Tiempo Estimado:** 2-3h

### Checklist
- [ ] 0.1 Crear estructura de directorios completa
  ```bash
  mkdir -p vouchers-hostal-playa-norte/{backend/{src/{config,middleware,routes,services,utils},db/{migrations,seeds},tests/{unit,integration,e2e},logs},pwa-cafeteria/{src/{components,services,workers,utils},public/icons},docs,scripts}
  ```
  - [ ] Verificar estructura con `tree -L 3`
  - [ ] Validar permisos de escritura

- [ ] 0.2 Inicializar backend (Node.js)
  ```bash
  cd vouchers-hostal-playa-norte/backend
  npm init -y
  ```
  - [ ] Editar package.json con info correcta
  - [ ] Configurar scripts (start, dev, test)

- [ ] 0.3 Instalar dependencias backend
  ```bash
  npm install express better-sqlite3 jsonwebtoken bcryptjs qrcode cors helmet express-rate-limit winston dotenv uuid zod date-fns-tz
  npm install --save-dev jest supertest nodemon eslint @types/jest
  ```
  - [ ] Verificar instalación: `npm list --depth=0`
  - [ ] Revisar package-lock.json

- [ ] 0.4 Inicializar frontend (React PWA)
  ```bash
  cd ../pwa-cafeteria
  npx create-react-app . --template pwa
  npm install react-router-dom idb axios workbox-webpack-plugin html5-qrcode
  ```
  - [ ] Verificar `src/serviceWorkerRegistration.js` existe
  - [ ] Validar `manifest.json` presente

- [ ] 0.5 Configurar herramientas de desarrollo
  - [ ] Crear `.eslintrc.json` backend
  - [ ] Crear `.eslintrc.json` frontend  
  - [ ] Crear `.prettierrc` (opcional)
  - [ ] Configurar `.gitignore` (node_modules, .env, logs)
  - [ ] Crear `.env.example` con variables template

- [ ] 0.6 Configurar Git
  ```bash
  git add .
  git commit -m "feat: initial project setup - MÓDULO 0"
  git push origin main
  ```

### Criterios de Aceptación
- ✅ Estructura de carpetas completa
- ✅ package.json configurados (backend + frontend)
- ✅ Dependencias instaladas sin errores
- ✅ Node version >= 18.0.0
- ✅ Git commit realizado

### Tiempo Real: _____ horas

---

## 🗄️ MÓDULO 1: BASE DE DATOS Y CONFIGURACIÓN
**Estado:** ⏸️ Pendiente | **Prioridad:** 🔴 CRÍTICA | **Tiempo Estimado:** 4-6h

### Checklist

#### 1.1 Schema SQL
- [ ] Crear `backend/db/schema.sql`
  - [ ] Tabla `users` con constraints
  - [ ] Tabla `cafeterias`
  - [ ] Tabla `stays` con CHECK constraints
  - [ ] Tabla `vouchers` con UNIQUE(code)
  - [ ] Tabla `redemptions` con UNIQUE(voucher_id) ⚠️ CRÍTICO
  - [ ] Tabla `sync_log`
  - [ ] Todos los indexes definidos
  - [ ] Foreign keys con CASCADE/RESTRICT

- [ ] Validar schema
  ```bash
  sqlite3 test.db < db/schema.sql
  sqlite3 test.db ".schema"
  ```

#### 1.2 Migraciones
- [ ] Crear `backend/db/migrations/001_initial.sql`
- [ ] Crear `backend/db/migrations/002_indexes.sql`
- [ ] Implementar `backend/scripts/migrate.js`
  - [ ] Tracking de migraciones aplicadas
  - [ ] Rollback capability

#### 1.3 Seeds
- [ ] Crear `backend/db/seeds/001_users.sql`
  - [ ] Usuario admin (bcrypt hash)
  - [ ] Usuario recepción
  - [ ] Usuario cafetería
- [ ] Crear `backend/db/seeds/002_cafeterias.sql`
  - [ ] Cafetería Principal
  - [ ] Cafetería Secundaria (opcional)
- [ ] Crear `backend/db/seeds/003_stays.sql`
  - [ ] 5-10 estadías de prueba
- [ ] Implementar `backend/scripts/seed.js`

#### 1.4 Database Manager
- [ ] Implementar `backend/src/config/database.js`
  - [ ] Singleton pattern
  - [ ] WAL mode configuration
  - [ ] Foreign keys ON
  - [ ] Transaction helper
  - [ ] Error handling
  - [ ] Logging

#### 1.5 Testing
- [ ] Ejecutar migraciones en DB test
  ```bash
  npm run db:setup
  npm run db:migrate
  npm run db:seed
  ```
- [ ] Validar datos con queries básicas
  ```sql
  SELECT * FROM users;
  SELECT * FROM vouchers LIMIT 5;
  ```

### Criterios de Aceptación
- ✅ Schema completo y ejecutable
- ✅ Migraciones funcionando
- ✅ Seeds con datos válidos
- ✅ Database manager operativo
- ✅ Queries básicas exitosas
- ✅ UNIQUE constraints validados

### Tiempo Real: _____ horas

---

## ⚙️ MÓDULO 2: BACKEND CORE - CONFIGURACIÓN BASE
**Estado:** ⏸️ Pendiente | **Prioridad:** 🔴 CRÍTICA | **Tiempo Estimado:** 5-7h

### Checklist

#### 2.1 Environment Variables
- [ ] Crear `backend/.env.example`
  ```env
  NODE_ENV=development
  PORT=3000
  TZ=America/Argentina/Buenos_Aires
  DATABASE_PATH=./vouchers.db
  VOUCHER_SECRET=<generar>
  JWT_SECRET=<generar>
  JWT_EXPIRATION=24h
  ALLOWED_ORIGINS=http://localhost:3001
  ```
- [ ] Implementar `backend/src/config/environment.js`
  - [ ] Validación con Zod
  - [ ] Error handling si faltan variables
  - [ ] Set timezone

- [ ] Generar secretos seguros
  ```bash
  openssl rand -hex 32  # VOUCHER_SECRET
  openssl rand -hex 32  # JWT_SECRET
  ```

#### 2.2 Logger (Winston)
- [ ] Implementar `backend/src/config/logger.js`
  - [ ] Console transport (dev)
  - [ ] File transport (error.log)
  - [ ] File transport (combined.log)
  - [ ] JSON format
  - [ ] Rotation (10MB, 5 files)
  - [ ] Audit logger separado

- [ ] Test logging
  ```javascript
  logger.info('Test info');
  logger.error('Test error');
  ```

#### 2.3 Express Server
- [ ] Implementar `backend/src/server.js`
  - [ ] Express app setup
  - [ ] Body parser (json)
  - [ ] CORS configuration
  - [ ] Helmet security headers
  - [ ] Health check endpoint `/api/health`
  - [ ] Error handling middleware
  - [ ] 404 handler
  - [ ] Graceful shutdown

- [ ] Iniciar servidor
  ```bash
  npm run dev
  curl http://localhost:3000/api/health
  ```

#### 2.4 Database Integration
- [ ] Integrar database en server.js
- [ ] Initialize on startup
- [ ] Health check verifica DB connection

### Criterios de Aceptación
- ✅ Variables validadas con Zod
- ✅ Timezone configurada (Argentina)
- ✅ Logs se escriben correctamente
- ✅ Servidor inicia sin errores
- ✅ Health check responde 200
- ✅ CORS configurado
- ✅ Graceful shutdown funciona

### Tiempo Real: _____ horas

---

## 🛡️ MÓDULO 3: BACKEND CORE - MIDDLEWARE
**Estado:** ⏸️ Pendiente | **Prioridad:** 🔴 CRÍTICA | **Tiempo Estimado:** 4-5h

### Checklist

#### 3.1 Correlation ID
- [ ] Implementar `backend/src/middleware/correlation.js`
  - [ ] Generar UUID v4
  - [ ] Header `x-correlation-id`
  - [ ] Agregar a req.correlationId
  - [ ] Agregar a res headers

#### 3.2 Authentication (JWT)
- [ ] Implementar `backend/src/middleware/auth.js`
  - [ ] authMiddleware: verify JWT
  - [ ] Extract user from token
  - [ ] Handle expired tokens
  - [ ] Logging de eventos auth

#### 3.3 Authorization (RBAC)
- [ ] Implementar `requireRole(['admin', 'reception'])`
  - [ ] Validar req.user.role
  - [ ] Return 403 si insuficiente
  - [ ] Logging de denials

#### 3.4 Rate Limiting
- [ ] Implementar `backend/src/middleware/rateLimiter.js`
  - [ ] validateLimiter (100/min)
  - [ ] redeemLimiter (50/min per device)
  - [ ] syncLimiter (10/min per device)
  - [ ] Custom error handler

#### 3.5 Error Handler
- [ ] Implementar `backend/src/middleware/errorHandler.js`
  - [ ] AppError class
  - [ ] ValidationError class
  - [ ] NotFoundError class
  - [ ] ConflictError class
  - [ ] errorHandler middleware
  - [ ] notFoundHandler middleware

#### 3.6 Testing Middleware
- [ ] Test JWT generation y validation
- [ ] Test RBAC con diferentes roles
- [ ] Test rate limiting (simular muchas requests)
- [ ] Test error handling

### Criterios de Aceptación
- ✅ Correlation ID en todos los logs
- ✅ JWT valida correctamente
- ✅ RBAC previene acceso no autorizado
- ✅ Rate limiters activos
- ✅ Errores manejados consistentemente
- ✅ Tests de middleware pasan

### Tiempo Real: _____ horas

---

## 🔧 MÓDULO 4: BACKEND CORE - SERVICIOS DE NEGOCIO
**Estado:** ⏸️ Pendiente | **Prioridad:** 🔴 CRÍTICA | **Tiempo Estimado:** 8-10h

### Checklist

#### 4.1 CryptoService
- [ ] Implementar `backend/src/services/cryptoService.js`
  - [ ] generateVoucherHMAC(code, from, until, stayId)
  - [ ] verifyVoucherHMAC() con timing-safe
  - [ ] generateVoucherCode(sequenceNumber)
  - [ ] parseQRData(qrData)

- [ ] Tests
  ```javascript
  - [ ] HMAC genera correctamente
  - [ ] Verificación detecta tampering
  - [ ] Timing-safe comparison
  - [ ] Parse QR válido/inválido
  ```

#### 4.2 QRService
- [ ] Implementar `backend/src/services/qrService.js`
  - [ ] generateVoucherQR(voucher) → dataURL
  - [ ] validateQRFormat(qrData)
  - [ ] Error correction level H
  - [ ] Width 300px

- [ ] Tests
  ```javascript
  - [ ] QR genera imagen base64
  - [ ] Formato validado correctamente
  ```

#### 4.3 VoucherService (CORE)
- [ ] Implementar `backend/src/services/voucherService.js`

##### 4.3.1 Emisión
- [ ] emitVouchers({ stay_id, valid_from, valid_until, breakfast_count })
  - [ ] Validar estadía existe
  - [ ] Validar fechas en rango
  - [ ] Transaction wrapper
  - [ ] Generar códigos únicos
  - [ ] Generar HMAC por cada voucher
  - [ ] INSERT vouchers
  - [ ] Generar QR codes
  - [ ] Auditoría

- [ ] Tests emisión
  ```javascript
  - [ ] Emite N vouchers correctamente
  - [ ] Códigos únicos y secuenciales
  - [ ] HMAC válidos
  - [ ] QR generados
  - [ ] Transaction rollback en error
  ```

##### 4.3.2 Validación
- [ ] validateVoucher({ code, hmac })
  - [ ] Verificar voucher existe
  - [ ] Verificar HMAC
  - [ ] Validar estado (active)
  - [ ] Validar fechas
  - [ ] Verificar no canjeado
  - [ ] Return voucher data

- [ ] Tests validación
  ```javascript
  - [ ] Voucher válido → true
  - [ ] Expirado → false (EXPIRED)
  - [ ] Canjeado → false (ALREADY_REDEEMED)
  - [ ] HMAC inválido → error
  ```

##### 4.3.3 Canje Atómico
- [ ] redeemVoucher({ code, cafeteria_id, device_id })
  - [ ] BEGIN TRANSACTION
  - [ ] SELECT voucher FOR UPDATE
  - [ ] Validar estado y fechas
  - [ ] INSERT redemptions (UNIQUE constraint)
  - [ ] UPDATE voucher status
  - [ ] COMMIT
  - [ ] Catch UNIQUE violation → ConflictError
  - [ ] Auditoría

- [ ] Tests canje ⚠️ CRÍTICOS
  ```javascript
  - [ ] Canje exitoso actualiza todo
  - [ ] Doble canje detectado (UNIQUE)
  - [ ] Transaction rollback en error
  - [ ] Voucher expirado rechazado
  - [ ] Logs de auditoría completos
  ```

##### 4.3.4 Cancelación
- [ ] cancelVoucher({ code, reason })
  - [ ] Verificar no canjeado
  - [ ] UPDATE status = 'cancelled'
  - [ ] Auditoría

#### 4.4 SyncService
- [ ] Implementar `backend/src/services/syncService.js`
  - [ ] syncRedemptions({ device_id, redemptions[] })
  - [ ] For each: try redeem, catch conflicts
  - [ ] INSERT sync_log
  - [ ] Return { synced, conflicts, errors }

- [ ] Tests sync
  ```javascript
  - [ ] Batch sync procesa todos
  - [ ] Conflictos detectados
  - [ ] Sync_log registra todo
  ```

### Criterios de Aceptación
- ✅ Todos los servicios implementados
- ✅ HMAC signing funciona
- ✅ QR codes generan correctamente
- ✅ Emisión transaccional
- ✅ Validación completa
- ✅ Canje atómico con UNIQUE constraint
- ✅ Sync offline funciona
- ✅ Tests unitarios >80% coverage

### Tiempo Real: _____ horas

---

## 🛣️ MÓDULO 5: BACKEND CORE - API ROUTES
**Estado:** ⏸️ Pendiente | **Prioridad:** 🔴 CRÍTICA | **Tiempo Estimado:** 6-8h

### Checklist

#### 5.1 Auth Routes
- [ ] Implementar `backend/src/routes/auth.js`
  - [ ] POST /api/auth/login
    - [ ] Validar username/password
    - [ ] bcrypt.compare()
    - [ ] Generar JWT
    - [ ] Return token + user
  - [ ] POST /api/auth/refresh
    - [ ] Validar refresh token
    - [ ] Generar nuevo JWT
  - [ ] POST /api/auth/logout
    - [ ] Invalidar token (blacklist opcional)

- [ ] Tests auth
  ```javascript
  - [ ] Login exitoso
  - [ ] Login fallido (credenciales)
  - [ ] Token válido en requests
  - [ ] Token expirado rechazado
  ```

#### 5.2 Voucher Routes
- [ ] Implementar `backend/src/routes/vouchers.js`
  - [ ] POST /api/vouchers [admin, reception]
    - [ ] Body validation (Zod)
    - [ ] VoucherService.emitVouchers()
    - [ ] Return vouchers + QR
  
  - [ ] GET /api/vouchers/:code [all authenticated]
    - [ ] VoucherService.getVoucher()
    - [ ] Return voucher data
  
  - [ ] POST /api/vouchers/validate [cafeteria]
    - [ ] Rate limiter: validateLimiter
    - [ ] VoucherService.validateVoucher()
    - [ ] Return validation result
  
  - [ ] POST /api/vouchers/redeem [cafeteria]
    - [ ] Rate limiter: redeemLimiter
    - [ ] VoucherService.redeemVoucher()
    - [ ] Handle ConflictError
    - [ ] Return redemption
  
  - [ ] DELETE /api/vouchers/:code [admin]
    - [ ] VoucherService.cancelVoucher()

- [ ] Tests voucher routes
  ```javascript
  - [ ] POST vouchers → 201
  - [ ] GET voucher → 200 with data
  - [ ] Validate → 200 with validation
  - [ ] Redeem → 200 success
  - [ ] Redeem duplicate → 409 conflict
  - [ ] Delete → 200
  - [ ] Auth required en todos
  ```

#### 5.3 Sync Routes
- [ ] Implementar `backend/src/routes/sync.js`
  - [ ] POST /api/sync/redemptions [cafeteria]
    - [ ] Rate limiter: syncLimiter
    - [ ] Body validation
    - [ ] SyncService.syncRedemptions()
    - [ ] Return results
  
  - [ ] GET /api/sync/conflicts [cafeteria]
    - [ ] Query conflicts for device
    - [ ] Return list
  
  - [ ] POST /api/sync/resolve [cafeteria]
    - [ ] Resolve conflict manually

- [ ] Tests sync routes
  ```javascript
  - [ ] Batch sync → 200 with results
  - [ ] Conflicts listed correctly
  - [ ] Resolution works
  ```

#### 5.4 Report Routes
- [ ] Implementar `backend/src/routes/reports.js`
  - [ ] GET /api/reports/redemptions [admin, reception]
    - [ ] Query params: from, to, format
    - [ ] ReportService.generateCSV() si format=csv
    - [ ] Return CSV o JSON
  
  - [ ] GET /api/reports/stays [admin, reception]
    - [ ] List stays con voucher count
  
  - [ ] GET /api/reports/metrics [admin]
    - [ ] Business metrics

- [ ] Tests reports
  ```javascript
  - [ ] CSV genera correctamente
  - [ ] Filters funcionan
  - [ ] Metrics calculadas OK
  ```

#### 5.5 Integration
- [ ] Integrar routes en server.js
  ```javascript
  app.use('/api/auth', authRoutes);
  app.use('/api/vouchers', voucherRoutes);
  app.use('/api/sync', syncRoutes);
  app.use('/api/reports', reportRoutes);
  ```

- [ ] Documentar API (OpenAPI)
  - [ ] Crear `docs/api-specification.yaml`
  - [ ] Documentar todos los endpoints
  - [ ] Ejemplos de requests/responses

### Criterios de Aceptación
- ✅ Todos los endpoints implementados
- ✅ Validación de inputs (Zod)
- ✅ Auth/RBAC funcionando
- ✅ Rate limiting activo
- ✅ Error handling consistente
- ✅ Tests de integración >80%
- ✅ API documentada (OpenAPI)

### Tiempo Real: _____ horas

---

## 📊 MÓDULO 6: BACKEND - REPORTES Y AUDITORÍA
**Estado:** ⏸️ Pendiente | **Prioridad:** 🟡 ALTA | **Tiempo Estimado:** 4-5h

### Checklist

#### 6.1 ReportService
- [ ] Implementar `backend/src/services/reportService.js`
  - [ ] generateRedemptionsCSV({ from, to })
    - [ ] Query con JOINs (vouchers, stays, cafeterias)
    - [ ] Incluir device_id y cafeteria_name
    - [ ] Ordenar por redeemed_at
    - [ ] Format CSV
  
  - [ ] generateMetrics()
    - [ ] Total emitted
    - [ ] Total redeemed
    - [ ] Redemption rate
    - [ ] Peak hours
    - [ ] Top cafeterias

#### 6.2 CSV Generator
- [ ] Implementar `backend/src/utils/csvGenerator.js`
  - [ ] arrayToCSV(data, headers)
  - [ ] Escape commas y quotes
  - [ ] UTF-8 BOM

#### 6.3 Test Case #10 (CRÍTICO)
- [ ] Implementar test completo
  ```javascript
  describe('CSV Reconciliation - Test Case #10', () => {
    it('should include 7 rows: 3 online + 4 offline', async () => {
      // Setup: 10 vouchers
      // 3 online redemptions
      // 4 offline redemptions (synced)
      // Generate CSV
      // Assert 8 lines (header + 7 data)
      // Assert includes device_id
      // Assert includes cafeteria
    });
  });
  ```

- [ ] Validar CSV manualmente
  - [ ] Descargar CSV desde API
  - [ ] Abrir en Excel/LibreOffice
  - [ ] Verificar datos correctos

### Criterios de Aceptación
- ✅ CSV genera correctamente
- ✅ Incluye online y offline
- ✅ device_id presente
- ✅ cafeteria_name presente
- ✅ Test Case #10 implementado y passing
- ✅ Métricas calculadas correctamente
- ✅ Performance aceptable (<2s)

### Tiempo Real: _____ horas

---

## 🎨 MÓDULO 7: PWA FRONTEND - SETUP BASE
**Estado:** ⏸️ Pendiente | **Prioridad:** 🔴 CRÍTICA | **Tiempo Estimado:** 3-4h

### Checklist

#### 7.1 React App Configuration
- [ ] Limpiar proyecto create-react-app
  - [ ] Eliminar archivos innecesarios
  - [ ] Actualizar App.js

#### 7.2 PWA Configuration
- [ ] Editar `public/manifest.json`
  ```json
  {
    "short_name": "Vouchers HPN",
    "name": "Vouchers Hostal Playa Norte",
    "icons": [...],
    "start_url": ".",
    "display": "standalone",
    "theme_color": "#2196F3",
    "background_color": "#ffffff"
  }
  ```

- [ ] Crear iconos PWA
  - [ ] 192x192
  - [ ] 512x512
  - [ ] Favicon

- [ ] Registrar Service Worker
  - [ ] En `src/index.js`: serviceWorkerRegistration.register()

#### 7.3 Router Setup
- [ ] Implementar `src/App.js` con React Router
  - [ ] Route: /login
  - [ ] Route: /scanner
  - [ ] Route: /redemptions
  - [ ] Route: /sync
  - [ ] Route: /settings
  - [ ] ProtectedRoute wrapper

#### 7.4 IndexedDB Setup
- [ ] Implementar `src/services/indexeddb.js`
  - [ ] openDB('vouchers-db', version)
  - [ ] Object stores:
    - [ ] pending_redemptions
    - [ ] vouchers_cache
    - [ ] sync_conflicts
    - [ ] auth_tokens
  
  - [ ] CRUD helpers:
    - [ ] add()
    - [ ] getAll()
    - [ ] get()
    - [ ] update()
    - [ ] delete()

#### 7.5 Styling Setup
- [ ] Elegir solución CSS
  - [ ] Opción A: CSS vanilla
  - [ ] Opción B: Tailwind CSS
  - [ ] Opción C: Material-UI

- [ ] Crear theme básico
  - [ ] Colores
  - [ ] Typography
  - [ ] Spacing

### Criterios de Aceptación
- ✅ PWA instala correctamente
- ✅ manifest.json configurado
- ✅ Service Worker activo
- ✅ Router funciona
- ✅ IndexedDB operativo
- ✅ Estilos aplicados
- ✅ Responsive design básico

### Tiempo Real: _____ horas

---

## 🧩 MÓDULO 8: PWA FRONTEND - COMPONENTES CORE
**Estado:** ⏸️ Pendiente | **Prioridad:** 🔴 CRÍTICA | **Tiempo Estimado:** 8-10h

### Checklist

#### 8.1 Login Component
- [ ] Crear `src/components/Login.jsx`
  - [ ] Form con username y password
  - [ ] Submit handler
  - [ ] Error display
  - [ ] Loading state
  - [ ] "Recuérdame" checkbox
  - [ ] Redirect después de login

- [ ] Styles y responsive

#### 8.2 Scanner Component
- [ ] Crear `src/components/Scanner.jsx`
  - [ ] HTML5 QR Scanner integration (html5-qrcode)
  - [ ] Camera permissions
  - [ ] QR detection handler
  - [ ] Error handling
  - [ ] Toggle camera on/off

- [ ] Input manual fallback
  - [ ] Text input para código
  - [ ] Validación formato
  - [ ] Submit button

- [ ] Tests básicos del scanner

#### 8.3 RedemptionForm Component
- [ ] Crear `src/components/RedemptionForm.jsx`
  - [ ] Display voucher data
  - [ ] Confirmación de canje
  - [ ] Loading states
  - [ ] Success/error feedback
  - [ ] Handle offline mode

#### 8.4 VoucherDetail Component
- [ ] Crear `src/components/VoucherDetail.jsx`
  - [ ] Display code, guest, room, dates
  - [ ] Visual status (valid/invalid/expired)
  - [ ] Botones de acción

#### 8.5 SyncStatus Component
- [ ] Crear `src/components/SyncStatus.jsx`
  - [ ] Online/offline indicator
  - [ ] Pending count badge
  - [ ] Last sync timestamp
  - [ ] Manual sync button
  - [ ] Conflicts badge

#### 8.6 ConflictsList Component
- [ ] Crear `src/components/ConflictsList.jsx`
  - [ ] List conflicts
  - [ ] Mostrar datos local vs server
  - [ ] Botones de resolución (keep local / keep server)

#### 8.7 Navigation Component
- [ ] Crear `src/components/Navigation.jsx`
  - [ ] Bottom navigation bar
  - [ ] Icons para secciones
  - [ ] Active state

### Criterios de Aceptación
- ✅ Todos los componentes implementados
- ✅ Scanner detecta QR
- ✅ Input manual funciona
- ✅ Forms validan correctamente
- ✅ Loading states visibles
- ✅ Errores muestran mensajes
- ✅ Sync status actualiza
- ✅ Responsive en móviles

### Tiempo Real: _____ horas

---

## ⚡ MÓDULO 9: PWA FRONTEND - SERVICIOS Y LÓGICA
**Estado:** ⏸️ Pendiente | **Prioridad:** 🔴 CRÍTICA | **Tiempo Estimado:** 6-8h

### Checklist

#### 9.1 API Client
- [ ] Implementar `src/services/api.js`
  - [ ] axios instance con baseURL
  - [ ] Request interceptor (add JWT)
  - [ ] Response interceptor (handle errors)
  - [ ] Methods:
    - [ ] login(username, password)
    - [ ] validateVoucher(code, hmac)
    - [ ] redeemVoucher(code, cafeteriaId, deviceId)
    - [ ] syncRedemptions(deviceId, redemptions)
    - [ ] getConflicts(deviceId)

#### 9.2 IndexedDB Manager (ampliado)
- [ ] Ampliar `src/services/indexeddb.js`
  - [ ] addPendingRedemption(data)
  - [ ] getPendingRedemptions()
  - [ ] deletePendingRedemption(localId)
  - [ ] addConflict(data)
  - [ ] getConflicts()
  - [ ] updateConflict(id, resolution)

#### 9.3 Sync Service
- [ ] Implementar `src/services/sync.js`
  - [ ] checkOnlineStatus()
  - [ ] syncPendingRedemptions()
    - [ ] Get pending from IndexedDB
    - [ ] POST to /api/sync/redemptions
    - [ ] Process results
    - [ ] Delete synced
    - [ ] Store conflicts
  
  - [ ] resolveConflict(conflictId, choice)
  
  - [ ] setupAutoSync()
    - [ ] Event listener 'online'
    - [ ] Trigger sync

#### 9.4 Crypto Service (Local HMAC)
- [ ] Implementar `src/services/crypto.js`
  - [ ] generateHMAC(code, validFrom, validUntil, stayId)
  - [ ] verifyHMAC(voucher, receivedHmac)
  - [ ] parseQR(qrData)

⚠️ Nota: Implementar crypto-js o Web Crypto API

#### 9.5 Auth Service
- [ ] Implementar `src/services/auth.js`
  - [ ] login(username, password)
  - [ ] logout()
  - [ ] getToken()
  - [ ] getUserInfo()
  - [ ] isAuthenticated()
  - [ ] refreshToken() (opcional)

- [ ] Store token en localStorage

#### 9.6 Device ID
- [ ] Generar y almacenar device_id único
  ```javascript
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem('device_id', deviceId);
  }
  ```

### Criterios de Aceptación
- ✅ API client maneja requests
- ✅ Interceptores funcionan
- ✅ IndexedDB CRUD completo
- ✅ Sync detecta online/offline
- ✅ Sync automático funciona
- ✅ HMAC valida localmente
- ✅ Auth persiste sesión
- ✅ Device ID único generado

### Tiempo Real: _____ horas

---

## 🔄 MÓDULO 10: PWA FRONTEND - SERVICE WORKER
**Estado:** ⏸️ Pendiente | **Prioridad:** 🔴 CRÍTICA | **Tiempo Estimado:** 4-6h

### Checklist

#### 10.1 Service Worker Base
- [ ] Editar `src/service-worker.js` (si no usa Workbox)
  - [ ] Install event
  - [ ] Activate event
  - [ ] Fetch event

#### 10.2 Cache Strategy
- [ ] Precache static assets
  ```javascript
  const CACHE_NAME = 'vouchers-v1';
  const urlsToCache = [
    '/',
    '/static/js/main.js',
    '/static/css/main.css',
    '/manifest.json'
  ];
  ```

- [ ] Cache-First para assets
- [ ] Network-First para API calls
  - [ ] Fallback a cache si offline

#### 10.3 Background Sync
- [ ] Registrar sync tag
  ```javascript
  self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-redemptions') {
      event.waitUntil(syncPendingRedemptions());
    }
  });
  ```

- [ ] Implementar syncPendingRedemptions()
  - [ ] Open IndexedDB
  - [ ] Get pending
  - [ ] Fetch POST /api/sync/redemptions
  - [ ] Update IndexedDB based on results

#### 10.4 Offline Page
- [ ] Crear `public/offline.html`
- [ ] Precache offline page
- [ ] Return offline page si fetch falla

#### 10.5 Push Notifications (opcional)
- [ ] Request notification permission
- [ ] Handle push events
- [ ] Notify user cuando sync completa

#### 10.6 Testing SW
- [ ] Test en Chrome DevTools
  - [ ] Application > Service Workers
  - [ ] Verificar registration
  - [ ] Simulate offline
  - [ ] Trigger background sync

### Criterios de Aceptación
- ✅ SW registrado y activo
- ✅ Cache strategy funciona
- ✅ Offline page se muestra
- ✅ Background sync dispara
- ✅ Pending redemptions sincronizan
- ✅ Performance score >90 (Lighthouse)

### Tiempo Real: _____ horas

---

## 🧪 MÓDULO 11: TESTING - BACKEND UNIT TESTS
**Estado:** ⏸️ Pendiente | **Prioridad:** 🟡 ALTA | **Tiempo Estimado:** 6-8h

### Checklist

#### 11.1 Setup Testing
- [ ] Configurar Jest
  - [ ] jest.config.js
  - [ ] Test database separada
  - [ ] Setup/teardown hooks

#### 11.2 Services Tests
- [ ] `tests/unit/services/cryptoService.test.js`
  - [ ] HMAC generation
  - [ ] HMAC verification (valid/invalid)
  - [ ] Timing-safe comparison
  - [ ] QR parsing

- [ ] `tests/unit/services/qrService.test.js`
  - [ ] QR generation
  - [ ] Format validation

- [ ] `tests/unit/services/voucherService.test.js`
  - [ ] emitVouchers (success/fail)
  - [ ] validateVoucher (all states)
  - [ ] redeemVoucher (success/conflict/expired)
  - [ ] cancelVoucher

- [ ] `tests/unit/services/syncService.test.js`
  - [ ] Batch sync
  - [ ] Conflict detection
  - [ ] Error handling

#### 11.3 Middleware Tests
- [ ] `tests/unit/middleware/auth.test.js`
  - [ ] JWT validation
  - [ ] Expired token
  - [ ] Invalid token

- [ ] `tests/unit/middleware/rateLimiter.test.js`
  - [ ] Rate limit enforcement
  - [ ] Per-device limiting

#### 11.4 Utils Tests
- [ ] `tests/unit/utils/csvGenerator.test.js`
  - [ ] CSV formatting
  - [ ] Escape special chars

#### 11.5 Coverage
- [ ] Ejecutar coverage
  ```bash
  npm run test -- --coverage
  ```
- [ ] Verificar >80% coverage
- [ ] Revisar uncovered lines

### Criterios de Aceptación
- ✅ Todos los servicios testeados
- ✅ Middleware testeados
- ✅ Utils testeados
- ✅ Coverage >80%
- ✅ Todos los tests pasan
- ✅ Edge cases cubiertos

### Tiempo Real: _____ horas

---

## 🔗 MÓDULO 12: TESTING - BACKEND INTEGRATION TESTS
**Estado:** ⏸️ Pendiente | **Prioridad:** 🟡 ALTA | **Tiempo Estimado:** 8-10h

### Checklist

#### 12.1 Setup Integration Tests
- [ ] Crear test database
- [ ] Helper: setupTestDb()
- [ ] Helper: cleanupTestDb()
- [ ] Fixtures: test data

#### 12.2 Auth Routes Tests
- [ ] `tests/integration/routes/auth.test.js`
  - [ ] POST /api/auth/login (success/fail)
  - [ ] Token válido en requests
  - [ ] RBAC enforcement

#### 12.3 Voucher Routes Tests
- [ ] `tests/integration/routes/vouchers.test.js`
  - [ ] POST /api/vouchers → 201
  - [ ] GET /api/vouchers/:code → 200
  - [ ] POST /api/vouchers/validate → 200
  - [ ] POST /api/vouchers/redeem → 200
  - [ ] POST /api/vouchers/redeem (duplicate) → 409
  - [ ] DELETE /api/vouchers/:code → 200
  - [ ] Auth required

#### 12.4 Sync Routes Tests
- [ ] `tests/integration/routes/sync.test.js`
  - [ ] POST /api/sync/redemptions → 200
  - [ ] Batch processing
  - [ ] Conflict handling

#### 12.5 Report Routes Tests
- [ ] `tests/integration/routes/reports.test.js`
  - [ ] GET /api/reports/redemptions?format=csv
  - [ ] Verify CSV content
  - [ ] GET /api/reports/metrics

#### 12.6 Test Case #10 (CRÍTICO)
- [ ] Implementar test completo
  ```javascript
  it('Test Case #10: CSV with 7 rows (3 online + 4 offline)', async () => {
    // Setup: emit 10 vouchers
    // Redeem 3 online
    // Redeem 4 offline (via sync)
    // Generate CSV report
    // Assert 8 lines (header + 7)
    // Assert device_id present
    // Assert cafeteria present
  });
  ```

#### 12.7 Performance Tests
- [ ] Test response times (<500ms)
- [ ] Test concurrent requests
- [ ] Test database locks

### Criterios de Aceptación
- ✅ Todos los endpoints testeados
- ✅ Test Case #10 passing
- ✅ Transacciones ACID validadas
- ✅ Conflicts manejados
- ✅ Performance aceptable
- ✅ No race conditions

### Tiempo Real: _____ horas

---

## 🌐 MÓDULO 13: TESTING - E2E Y PWA TESTS
**Estado:** ⏸️ Pendiente | **Prioridad:** 🟡 ALTA | **Tiempo Estimado:** 6-8h

### Checklist

#### 13.1 Setup E2E Testing
- [ ] Instalar Playwright o Puppeteer
  ```bash
  npm install --save-dev @playwright/test
  npx playwright install
  ```

- [ ] Configurar playwright.config.js
  - [ ] Base URL
  - [ ] Browsers (chromium, firefox, webkit)

#### 13.2 Flujos E2E Críticos
- [ ] `tests/e2e/login.spec.js`
  - [ ] Login exitoso
  - [ ] Login fallido
  - [ ] Logout

- [ ] `tests/e2e/redemption-flow.spec.js`
  - [ ] Login → Scanner → Scan QR → Redeem → Success
  - [ ] Full flow online

- [ ] `tests/e2e/offline-flow.spec.js`
  - [ ] Login → Go offline → Scan QR → Queue
  - [ ] Go online → Auto sync → Success

- [ ] `tests/e2e/conflict-resolution.spec.js`
  - [ ] Crear conflicto (doble canje offline)
  - [ ] Detectar en sync
  - [ ] Resolver conflicto

#### 13.3 PWA Tests
- [ ] Test PWA install
  ```javascript
  test('PWA should be installable', async ({ page }) => {
    await page.goto('/');
    // Check manifest
    // Check service worker
    // Trigger install prompt
  });
  ```

- [ ] Test offline capability
  ```javascript
  test('Should work offline', async ({ page, context }) => {
    await page.goto('/');
    await context.setOffline(true);
    // Navigate
    // Scan voucher
    // Verify queued
  });
  ```

- [ ] Test cache strategy
  - [ ] Assets cached
  - [ ] API cached con fallback

#### 13.4 Performance Tests
- [ ] Lighthouse CI
  ```bash
  npm install -g @lhci/cli
  lhci autorun
  ```

- [ ] Verificar scores
  - [ ] Performance >90
  - [ ] Accessibility >90
  - [ ] Best Practices >90
  - [ ] SEO >80
  - [ ] PWA >90

#### 13.5 Visual Regression (opcional)
- [ ] Screenshots de componentes clave
- [ ] Comparar con baseline

### Criterios de Aceptación
- ✅ Flujos completos funcionan
- ✅ Offline mode testeado
- ✅ PWA instala correctamente
- ✅ Performance scores >90
- ✅ Accessibility >90
- ✅ Todos los tests E2E pasan

### Tiempo Real: _____ horas

---

## 🚀 MÓDULO 14: DESPLIEGUE - CONFIGURACIÓN FLY.IO
**Estado:** ⏸️ Pendiente | **Prioridad:** 🔴 CRÍTICA | **Tiempo Estimado:** 4-6h

### Checklist

#### 14.1 Cuenta Fly.io
- [ ] Crear cuenta en https://fly.io
- [ ] Instalar Fly CLI
  ```bash
  curl -L https://fly.io/install.sh | sh
  fly auth login
  ```

#### 14.2 Crear App
- [ ] Inicializar app
  ```bash
  cd backend
  fly launch --name hostal-vouchers --region gru
  ```

- [ ] Editar fly.toml generado
  ```toml
  app = "hostal-vouchers"
  primary_region = "gru"  # São Paulo
  
  [build]
    dockerfile = "Dockerfile"
  
  [env]
    PORT = "8080"
    NODE_ENV = "production"
    TZ = "America/Argentina/Buenos_Aires"
  
  [[services]]
    internal_port = 8080
    protocol = "tcp"
    
    [[services.ports]]
      handlers = ["http"]
      port = 80
    
    [[services.ports]]
      handlers = ["tls", "http"]
      port = 443
  
  [[mounts]]
    source = "vouchers_data"
    destination = "/data"
  ```

#### 14.3 Dockerfile
- [ ] Crear `backend/Dockerfile`
  ```dockerfile
  # Stage 1: Build
  FROM node:18-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci --only=production
  
  # Stage 2: Production
  FROM node:18-alpine
  RUN apk add --no-cache tini
  WORKDIR /app
  COPY --from=builder /app/node_modules ./node_modules
  COPY . .
  
  # Create data directory
  RUN mkdir -p /data
  
  EXPOSE 8080
  ENTRYPOINT ["/sbin/tini", "--"]
  CMD ["node", "src/server.js"]
  ```

- [ ] Crear `.dockerignore`
  ```
  node_modules
  npm-debug.log
  .env
  .env.*
  .git
  .gitignore
  tests
  *.test.js
  coverage
  logs
  ```

#### 14.4 Volume para Datos
- [ ] Crear volume
  ```bash
  fly volumes create vouchers_data --region gru --size 1
  ```

#### 14.5 Secrets
- [ ] Configurar secrets
  ```bash
  fly secrets set VOUCHER_SECRET=$(openssl rand -hex 32)
  fly secrets set JWT_SECRET=$(openssl rand -hex 32)
  fly secrets set ALLOWED_ORIGINS="https://pwa.hostalplayanorte.com"
  fly secrets set DATABASE_PATH="/data/vouchers.db"
  ```

#### 14.6 Deploy
- [ ] Primer deploy
  ```bash
  fly deploy
  ```

- [ ] Verificar deploy
  ```bash
  fly status
  fly logs
  ```

#### 14.7 Inicializar Base de Datos
- [ ] SSH a la instancia
  ```bash
  fly ssh console
  ```

- [ ] Ejecutar migraciones
  ```bash
  cd /app
  node scripts/setup-db.js
  node scripts/migrate.js
  node scripts/seed.js
  ```

#### 14.8 Health Check
- [ ] Configurar health check en fly.toml
  ```toml
  [checks]
    [checks.health]
      grace_period = "10s"
      interval = "30s"
      method = "GET"
      path = "/api/health"
      protocol = "http"
      timeout = "5s"
  ```

- [ ] Verificar health check
  ```bash
  curl https://hostal-vouchers.fly.dev/api/health
  ```

#### 14.9 Dominio Custom (opcional)
- [ ] Configurar dominio
  ```bash
  fly certs create vouchers.hostalplayanorte.com
  ```

- [ ] Update DNS (A/AAAA records)

### Criterios de Aceptación
- ✅ App desplegada en Fly.io
- ✅ Volume persiste datos
- ✅ Secrets configurados
- ✅ Health check funciona
- ✅ Logs visibles
- ✅ Database inicializada
- ✅ API accesible públicamente
- ✅ SSL activo

### Tiempo Real: _____ horas

---

## ⚙️ MÓDULO 15: CI/CD - GITHUB ACTIONS
**Estado:** ⏸️ Pendiente | **Prioridad:** 🟡 ALTA | **Tiempo Estimado:** 3-4h

### Checklist

#### 15.1 Workflow: Tests
- [ ] Crear `.github/workflows/test.yml`
  ```yaml
  name: Tests
  
  on: [push, pull_request]
  
  jobs:
    test:
      runs-on: ubuntu-latest
      
      steps:
        - uses: actions/checkout@v3
        
        - name: Setup Node.js
          uses: actions/setup-node@v3
          with:
            node-version: '18'
        
        - name: Install dependencies
          run: |
            cd backend
            npm ci
        
        - name: Run linter
          run: npm run lint
        
        - name: Run tests
          run: npm test -- --coverage
        
        - name: Upload coverage
          uses: codecov/codecov-action@v3
          with:
            files: ./backend/coverage/lcov.info
  ```

#### 15.2 Workflow: Build
- [ ] Crear `.github/workflows/build.yml`
  - [ ] Build Docker image
  - [ ] Push a registry (opcional)

#### 15.3 Workflow: Deploy
- [ ] Crear `.github/workflows/deploy.yml`
  ```yaml
  name: Deploy to Fly.io
  
  on:
    push:
      branches: [main]
  
  jobs:
    deploy:
      runs-on: ubuntu-latest
      
      steps:
        - uses: actions/checkout@v3
        
        - name: Setup Fly CLI
          uses: superfly/flyctl-actions/setup-flyctl@master
        
        - name: Deploy to Fly.io
          run: flyctl deploy --remote-only
          env:
            FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
        
        - name: Run smoke tests
          run: |
            curl -f https://hostal-vouchers.fly.dev/api/health || exit 1
  ```

- [ ] Configurar FLY_API_TOKEN en GitHub Secrets
  ```bash
  fly tokens create deploy
  # Copiar token a GitHub repo settings > Secrets
  ```

#### 15.4 Branch Protection
- [ ] Configurar en GitHub
  - [ ] Require pull request reviews
  - [ ] Require status checks to pass
  - [ ] Include administrators

#### 15.5 Badges
- [ ] Agregar badges a README.md
  ```markdown
  ![Tests](https://github.com/eevans-d/SIST_VOUCHERS_HOTEL/workflows/Tests/badge.svg)
  ![Deploy](https://github.com/eevans-d/SIST_VOUCHERS_HOTEL/workflows/Deploy/badge.svg)
  [![codecov](https://codecov.io/gh/eevans-d/SIST_VOUCHERS_HOTEL/branch/main/graph/badge.svg)](https://codecov.io/gh/eevans-d/SIST_VOUCHERS_HOTEL)
  ```

### Criterios de Aceptación
- ✅ Tests corren en CI
- ✅ Deploy automático funciona
- ✅ Coverage reporta correctamente
- ✅ Branch protection activo
- ✅ Badges visibles en README
- ✅ Notificaciones configuradas

### Tiempo Real: _____ horas

---

## 📚 MÓDULO 16: DOCUMENTACIÓN Y CAPACITACIÓN
**Estado:** ⏸️ Pendiente | **Prioridad:** 🟢 MEDIA | **Tiempo Estimado:** 4-5h

### Checklist

#### 16.1 API Documentation
- [ ] Completar `docs/api-specification.yaml` (OpenAPI 3.0)
  - [ ] Todos los endpoints
  - [ ] Request/response schemas
  - [ ] Auth requirements
  - [ ] Examples
  - [ ] Error codes

- [ ] Generar docs HTML
  ```bash
  npx redoc-cli bundle docs/api-specification.yaml
  ```

#### 16.2 Manual de Usuario
- [ ] Crear `docs/user-manual.md`
  - [ ] Instalación de PWA
  - [ ] Login
  - [ ] Escanear vouchers
  - [ ] Modo offline
  - [ ] Resolución de conflictos
  - [ ] Screenshots

#### 16.3 Guía Operativa
- [ ] Crear `docs/operational-guide.md`
  - [ ] Inicio/parada del sistema
  - [ ] Monitoreo básico
  - [ ] Backup y restore
  - [ ] Escalamiento
  - [ ] Comandos útiles

#### 16.4 Troubleshooting
- [ ] Crear `docs/troubleshooting.md`
  - [ ] Problemas comunes
  - [ ] Logs importantes
  - [ ] Contactos de soporte
  - [ ] FAQs

#### 16.5 README Principal
- [ ] Actualizar `README.md`
  - [ ] Descripción del proyecto
  - [ ] Features principales
  - [ ] Tech stack
  - [ ] Setup instructions
  - [ ] Enlaces a docs
  - [ ] Badges
  - [ ] Screenshots

#### 16.6 Materiales de Capacitación
- [ ] Crear presentación (slides)
- [ ] Grabar video demo (5-10 min)
- [ ] Quiz básico (opcional)

### Criterios de Aceptación
- ✅ API documentada (OpenAPI)
- ✅ Manual de usuario completo
- ✅ Guía operativa clara
- ✅ Troubleshooting útil
- ✅ README actualizado
- ✅ Materiales de capacitación listos

### Tiempo Real: _____ horas

---

## 📊 MÓDULO 17: MONITOREO Y OBSERVABILIDAD
**Estado:** ⏸️ Pendiente | **Prioridad:** 🟢 MEDIA | **Tiempo Estimado:** 3-4h

### Checklist

#### 17.1 Métricas de Aplicación
- [ ] Implementar endpoint `/api/metrics`
  - [ ] Total vouchers emitted (last 24h, 7d, 30d)
  - [ ] Total redemptions
  - [ ] Redemption rate
  - [ ] Average redemption time
  - [ ] Top cafeterias
  - [ ] Peak hours

#### 17.2 Health Check Avanzado
- [ ] Mejorar `/api/health`
  - [ ] Database connectivity
  - [ ] Disk space
  - [ ] Memory usage
  - [ ] Uptime
  - [ ] Version

#### 17.3 Alertas
- [ ] Configurar alertas Fly.io
  - [ ] High error rate (>5%)
  - [ ] Low memory (<50MB)
  - [ ] Health check failing

- [ ] Email notifications (opcional)

#### 17.4 Dashboard (opcional)
- [ ] Crear dashboard básico
  - [ ] Grafana o similar
  - [ ] Visualizar métricas
  - [ ] Queries útiles

#### 17.5 Log Rotation
- [ ] Configurar rotation en production
  ```javascript
  new winston.transports.File({
    filename: 'logs/error.log',
    maxsize: 10485760,  // 10MB
    maxFiles: 5
  })
  ```

#### 17.6 Retention Policy
- [ ] Definir política de retención
  - [ ] Logs: 30 días
  - [ ] Metrics: 90 días
  - [ ] Database backups: 7 días

### Criterios de Aceptación
- ✅ Métricas exportadas
- ✅ Health check completo
- ✅ Alertas configuradas
- ✅ Logs rotando
- ✅ Dashboard accesible (opcional)
- ✅ Retention policy documentada

### Tiempo Real: _____ horas

---

## 🎓 CAPACITACIÓN Y GO-LIVE

### Checklist de Capacitación
- [ ] Sesión 1: Introducción (30 min)
  - [ ] Objetivos del sistema
  - [ ] Beneficios
  - [ ] Overview general

- [ ] Sesión 2: Uso Recepción (45 min)
  - [ ] Login
  - [ ] Emisión de vouchers
  - [ ] Impresión/envío
  - [ ] Reportes

- [ ] Sesión 3: Uso Cafetería (45 min)
  - [ ] Login
  - [ ] Escaneo de vouchers
  - [ ] Modo offline
  - [ ] Resolución de conflictos

- [ ] Sesión 4: Administración (30 min)
  - [ ] Gestión de usuarios
  - [ ] Reportes avanzados
  - [ ] Troubleshooting básico

- [ ] Q&A y práctica (30 min)

### Checklist de Go-Live
- [ ] Backup de datos existentes (si hay)
- [ ] Deploy a producción
- [ ] Smoke tests en producción
- [ ] Monitoreo intensivo (primeras 48h)
- [ ] Soporte on-call disponible
- [ ] Documentación accesible
- [ ] Contactos de emergencia claros

---

## ✅ CHECKLIST FINAL PRE-PRODUCCIÓN

### Funcionalidad
- [ ] Emisión de vouchers funciona
- [ ] Validación funciona
- [ ] Canje online funciona
- [ ] Canje offline funciona
- [ ] Sincronización automática funciona
- [ ] Resolución de conflictos funciona
- [ ] Reportes CSV generan correctamente
- [ ] Métricas calculan correctamente

### Seguridad
- [ ] JWT signing con secret seguro
- [ ] HMAC signing con secret seguro
- [ ] Passwords hasheados (bcrypt)
- [ ] HTTPS activo
- [ ] CORS configurado correctamente
- [ ] Rate limiting activo
- [ ] Secrets en variables de entorno (no en código)
- [ ] Logs no exponen PII

### Performance
- [ ] API response time <500ms p95
- [ ] PWA First Contentful Paint <2s
- [ ] Lighthouse score >90
- [ ] No memory leaks
- [ ] Database queries optimizadas
- [ ] Indexes en columnas críticas

### Testing
- [ ] Unit tests >80% coverage
- [ ] Integration tests pasan
- [ ] E2E tests pasan
- [ ] Test Case #10 passing
- [ ] Performance tests pasan
- [ ] Accessibility tests >90

### DevOps
- [ ] CI/CD funcionando
- [ ] Deploy automático
- [ ] Rollback strategy probada
- [ ] Backups configurados
- [ ] Monitoring activo
- [ ] Alertas configuradas
- [ ] Logs accesibles

### Documentación
- [ ] API documentada (OpenAPI)
- [ ] Manual de usuario completo
- [ ] Guía operativa disponible
- [ ] Troubleshooting documentado
- [ ] README actualizado
- [ ] Comentarios en código crítico

### Capacitación
- [ ] Personal de recepción capacitado
- [ ] Personal de cafetería capacitado
- [ ] Administradores capacitados
- [ ] Materiales de referencia disponibles

---

## 📈 MÉTRICAS DE ÉXITO POST-DESPLIEGUE

### Semana 1
- [ ] Uptime >99%
- [ ] 0 incidents críticos
- [ ] <10 issues reportados
- [ ] Satisfacción usuario >4/5

### Semana 2-4
- [ ] Adopción >80%
- [ ] Reducción papel >90%
- [ ] Tiempo reconciliación -40%
- [ ] Satisfacción usuario >4.5/5

### Mes 2-3
- [ ] ROI positivo
- [ ] Cero fraudes detectados
- [ ] Uptime >99.9%
- [ ] Satisfacción usuario >4.7/5

---

## 🎉 FINALIZACIÓN DEL PROYECTO

### Entregables Finales
- [ ] Código fuente en GitHub
- [ ] App en producción (Fly.io)
- [ ] Documentación completa
- [ ] Personal capacitado
- [ ] Monitoreo activo
- [ ] Soporte definido

### Transferencia de Conocimiento
- [ ] Sesión de handover
- [ ] Documentación de contactos
- [ ] Procedimientos de emergencia
- [ ] Plan de mantenimiento

### Post-Mortem (opcional)
- [ ] Qué salió bien
- [ ] Qué mejorar
- [ ] Lecciones aprendidas
- [ ] Roadmap futuro

---

**🚀 ¡PROYECTO COMPLETADO! 🎊**

---

**Notas:**
- Marcar cada item al completar: `- [x]`
- Actualizar tiempos reales
- Documentar blockers
- Celebrar hitos intermedios

**Versión Checklist:** 1.0.0  
**Última Actualización:** 21/10/2025
