# 📋 PLANIFICACIÓN MAESTRA - SISTEMA VOUCHERS DIGITALES
## Hostal Playa Norte - Roadmap Completo Fase 0 → Despliegue

---

## 🎯 OBJETIVO PRINCIPAL
Desarrollar e implementar un **Sistema de Vouchers Digitales** completo, robusto y production-ready para el Hostal Playa Norte, desde el punto actual (repositorio vacío) hasta estar listo para despliegue en **Fly.io**.

---

## 📊 ESTADO ACTUAL (FASE 0)

### ✅ Completado
- [x] Repositorio GitHub creado y sincronizado
- [x] Documentación técnica completa disponible
- [x] Arquitectura y especificaciones definidas
- [x] Workspace local configurado

### 🔴 Pendiente
- [ ] Estructura de proyecto implementada
- [ ] Código base desarrollado
- [ ] Tests implementados
- [ ] Despliegue configurado

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### Stack Tecnológico
```
Frontend (PWA):
├── React 18+
├── Service Worker (offline-first)
├── IndexedDB (almacenamiento local)
├── HTML5 QR Scanner
└── Workbox (PWA optimization)

Backend (API):
├── Node.js 18+
├── Express.js
├── SQLite (better-sqlite3)
├── JWT (autenticación)
├── Winston (logging)
└── QRCode (generación)

Infraestructura:
├── Fly.io (hosting)
├── GitHub Actions (CI/CD)
├── SQLite persistente
└── Volumes para datos
```

### Principios Arquitectónicos
1. **Hexagonal/Clean Architecture**: Separación clara de capas
2. **Offline-First**: PWA con sincronización automática
3. **Event-Driven**: Service Worker como manejador de eventos
4. **Fail-Fast**: Validaciones tempranas
5. **Transacciones Atómicas**: ACID compliance

---

## 📅 ROADMAP DE DESARROLLO

### **MÓDULO 0: Preparación del Entorno**
**Duración:** 2-3 horas
**Prioridad:** 🔴 CRÍTICA

#### Tareas
- [ ] 0.1. Crear estructura completa de directorios
- [ ] 0.2. Inicializar proyectos (backend/frontend)
- [ ] 0.3. Configurar package.json y dependencias
- [ ] 0.4. Setup de herramientas de desarrollo
- [ ] 0.5. Configurar Git (gitignore, ramas)

#### Entregables
```
✓ Estructura de carpetas completa
✓ package.json configurados
✓ Dependencias instaladas
✓ ESLint/Prettier configurados
✓ .env.example creados
```

#### Checklist de Verificación
```bash
# Validar estructura
tree -L 3 -I 'node_modules|.git'

# Validar dependencias
cd backend && npm list --depth=0
cd ../pwa-cafeteria && npm list --depth=0

# Validar herramientas
npx eslint --version
node --version  # >= 18.0.0
```

---

### **MÓDULO 1: Base de Datos y Configuración**
**Duración:** 4-6 horas
**Prioridad:** 🔴 CRÍTICA
**Dependencias:** MÓDULO 0

#### Tareas
- [ ] 1.1. Diseñar schema SQL completo
- [ ] 1.2. Implementar sistema de migraciones
- [ ] 1.3. Crear seeds de datos iniciales
- [ ] 1.4. Configurar connection manager
- [ ] 1.5. Implementar funciones de utilidad DB

#### Entregables
```sql
✓ schema.sql con todas las tablas
✓ migrations/*.sql versionados
✓ seeds/*.sql con datos de prueba
✓ database.js (connection manager)
✓ Documentación del modelo de datos
```

#### Schema Principal
```sql
TABLAS CORE:
├── users (autenticación/autorización)
├── cafeterias (puntos de canje)
├── stays (estadías de huéspedes)
├── vouchers (vouchers digitales)
├── redemptions (canjes realizados)
└── sync_log (auditoría de sincronización)

CONSTRAINTS CRÍTICOS:
├── UNIQUE(voucher_id) en redemptions
├── CHECK validaciones de fechas
├── FOREIGN KEYS con CASCADE
└── Indexes en campos de búsqueda
```

#### Checklist de Verificación
- [ ] Todas las tablas creadas
- [ ] Foreign keys funcionando
- [ ] Indexes creados
- [ ] Seeds ejecutados correctamente
- [ ] Consultas básicas funcionando
- [ ] Transacciones ACID validadas

---

### **MÓDULO 2: Backend Core - Configuración Base**
**Duración:** 5-7 horas
**Prioridad:** 🔴 CRÍTICA
**Dependencias:** MÓDULO 1

#### Tareas
- [ ] 2.1. Configurar environment variables (zod)
- [ ] 2.2. Implementar logger estructurado (Winston)
- [ ] 2.3. Setup de servidor Express
- [ ] 2.4. Configurar CORS y seguridad (Helmet)
- [ ] 2.5. Implementar health check endpoint

#### Entregables
```
✓ config/environment.js (validación con Zod)
✓ config/logger.js (Winston + JSON format)
✓ config/database.js (SQLite manager)
✓ server.js (entry point)
✓ .env.example completo
```

#### Configuración Crítica
```javascript
// Variables obligatorias
VOUCHER_SECRET=<32-byte-hex>  // HMAC signing
JWT_SECRET=<32-byte-hex>      // JWT signing
TZ=America/Argentina/Buenos_Aires
ALLOWED_ORIGINS=<domains>
```

#### Checklist de Verificación
- [ ] Servidor inicia sin errores
- [ ] Environment variables validadas
- [ ] Logs estructurados en JSON
- [ ] Health check responde 200
- [ ] Zona horaria configurada correctamente
- [ ] CORS funcionando

---

### **MÓDULO 3: Backend Core - Middleware**
**Duración:** 4-5 horas
**Prioridad:** 🔴 CRÍTICA
**Dependencias:** MÓDULO 2

#### Tareas
- [ ] 3.1. Implementar correlation ID middleware
- [ ] 3.2. Implementar autenticación JWT
- [ ] 3.3. Implementar autorización por roles (RBAC)
- [ ] 3.4. Configurar rate limiters
- [ ] 3.5. Implementar error handler centralizado

#### Entregables
```
✓ middleware/correlation.js
✓ middleware/auth.js (JWT + RBAC)
✓ middleware/rateLimiter.js
✓ middleware/errorHandler.js
✓ Clases de error personalizadas
```

#### Rate Limiting Strategy
```
/api/vouchers/validate → 100 req/min
/api/vouchers/redeem  → 50 req/min (por device_id)
/api/sync/*           → 10 req/min (por device_id)
```

#### Checklist de Verificación
- [ ] JWT genera y valida correctamente
- [ ] RBAC funciona (admin/reception/cafeteria)
- [ ] Rate limiters activos
- [ ] Errores manejados centralizadamente
- [ ] Correlation ID en todos los logs
- [ ] Respuestas de error estandarizadas

---

### **MÓDULO 4: Backend Core - Servicios de Negocio**
**Duración:** 8-10 horas
**Prioridad:** 🔴 CRÍTICA
**Dependencias:** MÓDULO 3

#### Tareas
- [ ] 4.1. Implementar CryptoService (HMAC)
- [ ] 4.2. Implementar QRService (generación)
- [ ] 4.3. Implementar VoucherService (CRUD + validación)
- [ ] 4.4. Implementar RedemptionService (canje atómico)
- [ ] 4.5. Implementar SyncService (offline sync)

#### Entregables
```
✓ services/cryptoService.js
✓ services/qrService.js
✓ services/voucherService.js
✓ services/redemptionService.js
✓ services/syncService.js
```

#### Funciones Críticas

##### 4.3.1 Emisión de Vouchers
```javascript
emitVouchers({
  stay_id,
  valid_from,
  valid_until,
  breakfast_count
})
```
**Validaciones:**
- Estadía existe
- Fechas válidas
- Rango dentro de check-in/out
- Cantidad > 0

##### 4.3.2 Validación de Vouchers
```javascript
validateVoucher({ code, hmac })
```
**Validaciones:**
- Código existe
- HMAC válido
- Estado = 'active'
- Fecha actual en rango
- No canjeado previamente

##### 4.3.3 Canje Atómico
```javascript
redeemVoucher({
  code,
  cafeteria_id,
  device_id
})
```
**Garantías ACID:**
- Transaction wrapper
- UNIQUE constraint en redemptions
- Update voucher status
- Rollback automático en error

##### 4.4 Sincronización Offline
```javascript
syncRedemptions({
  device_id,
  redemptions: [
    {
      local_id,
      voucher_code,
      cafeteria_id,
      timestamp
    }
  ]
})
```
**Manejo de Conflictos:**
- Server wins policy
- Detección de duplicados
- Retry con backoff exponencial
- Log de auditoría completo

#### Checklist de Verificación
- [ ] HMAC genera correctamente (SHA-256)
- [ ] QR codes válidos (format, error correction H)
- [ ] Emisión crea vouchers correctamente
- [ ] Validación detecta todos los casos edge
- [ ] Canje atómico previene duplicados
- [ ] Sync maneja conflictos correctamente
- [ ] Logs de auditoría completos

---

### **MÓDULO 5: Backend Core - API Routes**
**Duración:** 6-8 horas
**Prioridad:** 🔴 CRÍTICA
**Dependencias:** MÓDULO 4

#### Tareas
- [ ] 5.1. Implementar /api/auth/* (login, refresh)
- [ ] 5.2. Implementar /api/vouchers/* (CRUD)
- [ ] 5.3. Implementar /api/sync/* (offline sync)
- [ ] 5.4. Implementar /api/reports/* (CSV, métricas)
- [ ] 5.5. Documentar API (OpenAPI 3.0)

#### Entregables
```
✓ routes/auth.js
✓ routes/vouchers.js
✓ routes/sync.js
✓ routes/reports.js
✓ docs/api-specification.yaml
```

#### Endpoints Principales

##### Autenticación
```
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
```

##### Vouchers
```
POST   /api/vouchers              [admin, reception]
GET    /api/vouchers/:code        [all]
POST   /api/vouchers/validate     [cafeteria]
POST   /api/vouchers/redeem       [cafeteria]
DELETE /api/vouchers/:code        [admin]
```

##### Sincronización
```
POST   /api/sync/redemptions      [cafeteria]
GET    /api/sync/conflicts        [cafeteria]
POST   /api/sync/resolve          [cafeteria]
```

##### Reportes
```
GET    /api/reports/redemptions   [admin, reception]
GET    /api/reports/stays         [admin, reception]
GET    /api/reports/metrics       [admin]
```

#### Checklist de Verificación
- [ ] Todos los endpoints responden
- [ ] Validación de inputs (Zod schemas)
- [ ] Autenticación/autorización funciona
- [ ] Rate limiting activo
- [ ] Responses estandarizadas
- [ ] Error handling completo
- [ ] Documentación OpenAPI actualizada

---

### **MÓDULO 6: Backend - Reportes y Auditoría**
**Duración:** 4-5 horas
**Prioridad:** 🟡 ALTA
**Dependencias:** MÓDULO 5

#### Tareas
- [ ] 6.1. Implementar generación de CSV
- [ ] 6.2. Implementar métricas de negocio
- [ ] 6.3. Implementar logs de auditoría
- [ ] 6.4. Implementar reconciliación
- [ ] 6.5. Crear dashboard de métricas

#### Entregables
```
✓ services/reportService.js
✓ services/metricsService.js
✓ utils/csvGenerator.js
✓ Reportes CSV funcionales
✓ Métricas de negocio
```

#### Reportes Requeridos

##### CSV de Canjes (Test Case #10)
```csv
code,guest_name,room,redeemed_at,cafeteria,device_id
HPN-2025-0001,Juan Pérez,101,2025-01-15 08:30,Cafetería Principal,device-001
HPN-2025-0002,Ana García,102,2025-01-15 08:45,Cafetería Principal,device-001
```

**Requisitos:**
- Incluir online y offline
- device_id obligatorio
- cafeteria_name obligatorio
- Filtros por fecha
- Ordenamiento por timestamp

##### Métricas de Negocio
```javascript
{
  total_vouchers_emitted: 150,
  total_redeemed: 120,
  total_pending: 20,
  total_expired: 10,
  redemption_rate: 0.80,
  avg_redemption_time: "08:45",
  peak_hours: ["08:00-09:00", "12:00-13:00"],
  top_cafeterias: [...]
}
```

#### Checklist de Verificación
- [ ] CSV genera correctamente
- [ ] Incluye canjes online/offline
- [ ] Métricas calculadas correctamente
- [ ] Reconciliación detecta discrepancias
- [ ] Logs de auditoría completos
- [ ] Performance aceptable (<2s)

---

### **MÓDULO 7: PWA Frontend - Setup Base**
**Duración:** 3-4 horas
**Prioridad:** 🔴 CRÍTICA
**Dependencias:** MÓDULO 0

#### Tareas
- [ ] 7.1. Crear proyecto React
- [ ] 7.2. Configurar PWA (manifest, service worker)
- [ ] 7.3. Setup de routing (React Router)
- [ ] 7.4. Configurar IndexedDB (idb)
- [ ] 7.5. Setup de estilos (CSS/Tailwind)

#### Entregables
```
✓ React app configurada
✓ manifest.json (PWA)
✓ Service Worker registrado
✓ IndexedDB setup
✓ Router configurado
```

#### PWA Manifest
```json
{
  "name": "Vouchers Hostal Playa Norte",
  "short_name": "Vouchers HPN",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2196F3",
  "icons": [...]
}
```

#### Checklist de Verificación
- [ ] App instala como PWA
- [ ] Service Worker activo
- [ ] IndexedDB funciona
- [ ] Router navega correctamente
- [ ] Estilos aplicados
- [ ] Responsive design

---

### **MÓDULO 8: PWA Frontend - Componentes Core**
**Duración:** 8-10 horas
**Prioridad:** 🔴 CRÍTICA
**Dependencias:** MÓDULO 7

#### Tareas
- [ ] 8.1. Implementar Login component
- [ ] 8.2. Implementar Scanner QR component
- [ ] 8.3. Implementar RedemptionForm component
- [ ] 8.4. Implementar SyncStatus component
- [ ] 8.5. Implementar ConflictsList component

#### Entregables
```
✓ components/Login.jsx
✓ components/Scanner.jsx
✓ components/RedemptionForm.jsx
✓ components/SyncStatus.jsx
✓ components/ConflictsList.jsx
✓ components/VoucherDetail.jsx
```

#### Componentes Críticos

##### Scanner QR
```jsx
Features:
- HTML5 QR Scanner
- Input manual fallback
- HMAC validation local
- Feedback visual inmediato
- Modo offline completo
```

##### RedemptionForm
```jsx
Features:
- Validación pre-canje
- Confirmación de datos
- Handling de errores
- Modo offline
- Estado de loading
```

##### SyncStatus
```jsx
Features:
- Indicador online/offline
- Contador de pendientes
- Botón sync manual
- Progress bar
- Estado de conflictos
```

#### Checklist de Verificación
- [ ] Scanner detecta QR correctamente
- [ ] Input manual funciona
- [ ] Formularios validan inputs
- [ ] Estados de loading visibles
- [ ] Errores muestran mensajes claros
- [ ] Sync status actualiza en real-time
- [ ] Modo offline completo funcional

---

### **MÓDULO 9: PWA Frontend - Servicios y Lógica**
**Duración:** 6-8 horas
**Prioridad:** 🔴 CRÍTICA
**Dependencias:** MÓDULO 8

#### Tareas
- [ ] 9.1. Implementar API client
- [ ] 9.2. Implementar IndexedDB manager
- [ ] 9.3. Implementar Sync service
- [ ] 9.4. Implementar Crypto service (HMAC local)
- [ ] 9.5. Implementar Auth service (JWT)

#### Entregables
```
✓ services/api.js
✓ services/indexeddb.js
✓ services/sync.js
✓ services/crypto.js
✓ services/auth.js
```

#### IndexedDB Schema
```javascript
DB: vouchers-db
Stores:
├── pending_redemptions (canjes offline)
├── vouchers_cache (validaciones)
├── sync_conflicts (conflictos)
└── auth_tokens (JWT cache)
```

#### Sync Strategy
```javascript
1. Detectar online/offline
2. En offline: Guardar en IndexedDB
3. En online: Sync automático
4. Background Sync (Service Worker)
5. Retry con backoff exponencial
6. Resolución de conflictos (server wins)
```

#### Checklist de Verificación
- [ ] API client maneja errores correctamente
- [ ] IndexedDB almacena offline
- [ ] Sync detecta online/offline
- [ ] Background sync funciona
- [ ] Conflictos se detectan
- [ ] HMAC valida localmente
- [ ] JWT refresh automático

---

### **MÓDULO 10: PWA Frontend - Service Worker**
**Duración:** 4-6 horas
**Prioridad:** 🔴 CRÍTICA
**Dependencias:** MÓDULO 9

#### Tareas
- [ ] 10.1. Implementar cache strategy
- [ ] 10.2. Implementar background sync
- [ ] 10.3. Implementar push notifications
- [ ] 10.4. Implementar offline fallback
- [ ] 10.5. Optimizar performance

#### Entregables
```
✓ workers/sw.js
✓ Cache strategies configuradas
✓ Background sync activo
✓ Offline page funcional
✓ Performance optimizado
```

#### Cache Strategy
```javascript
Static Assets: Cache-First
API Calls: Network-First (with fallback)
Images: Cache-First (with update)
Offline Page: Precache
```

#### Background Sync
```javascript
sync-redemptions: Sync pending redemptions
sync-conflicts: Fetch conflicts
sync-metrics: Update metrics
```

#### Checklist de Verificación
- [ ] Assets se cachean correctamente
- [ ] Offline page funciona
- [ ] Background sync dispara
- [ ] Performance score >90 (Lighthouse)
- [ ] Cache se actualiza correctamente
- [ ] Fallbacks funcionan

---

### **MÓDULO 11: Testing - Backend Unit Tests**
**Duración:** 6-8 horas
**Prioridad:** 🟡 ALTA
**Dependencias:** MÓDULO 6

#### Tareas
- [ ] 11.1. Tests de servicios (VoucherService)
- [ ] 11.2. Tests de middleware (auth, rate limit)
- [ ] 11.3. Tests de utilidades (crypto, QR)
- [ ] 11.4. Tests de database (queries)
- [ ] 11.5. Configurar coverage >80%

#### Entregables
```
✓ tests/unit/services/*.test.js
✓ tests/unit/middleware/*.test.js
✓ tests/unit/utils/*.test.js
✓ Coverage report >80%
✓ CI setup (GitHub Actions)
```

#### Tests Críticos
```javascript
✓ HMAC generation/verification
✓ QR code generation/parsing
✓ JWT generation/validation
✓ Voucher emission
✓ Voucher validation
✓ Atomic redemption
✓ Duplicate prevention
✓ Date validations (timezone)
```

#### Checklist de Verificación
- [ ] Todos los servicios testeados
- [ ] Coverage >80%
- [ ] Edge cases cubiertos
- [ ] Tests pasan en CI
- [ ] Mocks configurados correctamente
- [ ] Performance tests incluidos

---

### **MÓDULO 12: Testing - Backend Integration Tests**
**Duración:** 8-10 horas
**Prioridad:** 🟡 ALTA
**Dependencias:** MÓDULO 11

#### Tareas
- [ ] 12.1. Tests de endpoints (Supertest)
- [ ] 12.2. Tests de transacciones DB
- [ ] 12.3. Tests de sincronización offline
- [ ] 12.4. Tests de reconciliación (Test Case #10)
- [ ] 12.5. Tests de rate limiting

#### Entregables
```
✓ tests/integration/routes/*.test.js
✓ tests/integration/sync/*.test.js
✓ tests/integration/reports/*.test.js
✓ Test database setup/teardown
✓ Fixtures y helpers
```

#### Test Case #10 (Crítico)
```javascript
describe('CSV Reconciliation', () => {
  it('should generate CSV with 7 rows (3 online + 4 offline)', async () => {
    // Setup: 10 vouchers emitted
    // 3 online redemptions
    // 4 offline redemptions (synced)
    // 3 pending
    
    const csv = await getRedemptionsCSV();
    
    expect(csv).toHaveRows(8); // header + 7 data
    expect(csv).toIncludeColumns(['device_id', 'cafeteria']);
    expect(csv).toIncludeOnlineAndOffline();
  });
});
```

#### Checklist de Verificación
- [ ] Todos los endpoints testeados
- [ ] Transacciones ACID validadas
- [ ] Test Case #10 implementado
- [ ] Sync offline funciona
- [ ] Conflictos se manejan
- [ ] Rate limiting funciona
- [ ] Performance aceptable

---

### **MÓDULO 13: Testing - E2E y PWA Tests**
**Duración:** 6-8 horas
**Prioridad:** 🟡 ALTA
**Dependencias:** MÓDULO 10

#### Tareas
- [ ] 13.1. Setup Puppeteer/Playwright
- [ ] 13.2. Tests de flujo completo (emisión → canje)
- [ ] 13.3. Tests de modo offline
- [ ] 13.4. Tests de sincronización
- [ ] 13.5. Tests de PWA (install, cache)

#### Entregables
```
✓ tests/e2e/flows/*.test.js
✓ tests/e2e/offline/*.test.js
✓ tests/e2e/pwa/*.test.js
✓ Screenshots de tests
✓ Videos de tests críticos
```

#### Flujos E2E Críticos
```javascript
1. Login → Scan QR → Redeem → Success
2. Login → Offline Mode → Scan → Queue → Online → Sync
3. Login → Conflict Detection → Resolution
4. Admin → Emit Vouchers → Download PDF
5. Report → Generate CSV → Validate Data
```

#### Checklist de Verificación
- [ ] Flujos completos funcionan
- [ ] Modo offline testado
- [ ] Sincronización automática funciona
- [ ] PWA instala correctamente
- [ ] Performance tests pasan
- [ ] Accessibility tests >90

---

### **MÓDULO 14: Despliegue - Configuración Fly.io**
**Duración:** 4-6 horas
**Prioridad:** 🔴 CRÍTICA
**Dependencias:** MÓDULOS 1-13

#### Tareas
- [ ] 14.1. Crear cuenta y proyecto Fly.io
- [ ] 14.2. Configurar fly.toml
- [ ] 14.3. Crear Dockerfile multi-stage
- [ ] 14.4. Configurar volumes para SQLite
- [ ] 14.5. Setup de secretos y variables

#### Entregables
```
✓ fly.toml configurado
✓ Dockerfile optimizado
✓ .dockerignore
✓ Volumes configurados
✓ Secrets configurados
```

#### fly.toml
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

[[mounts]]
  source = "vouchers_data"
  destination = "/data"
```

#### Dockerfile Multi-Stage
```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Production
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 8080
CMD ["node", "src/server.js"]
```

#### Checklist de Verificación
- [ ] App despliega correctamente
- [ ] Volume persiste datos
- [ ] Secrets configurados
- [ ] Health check funciona
- [ ] Logs visibles
- [ ] Escala automáticamente

---

### **MÓDULO 15: CI/CD - GitHub Actions**
**Duración:** 3-4 horas
**Prioridad:** 🟡 ALTA
**Dependencias:** MÓDULO 14

#### Tareas
- [ ] 15.1. Configurar workflow de tests
- [ ] 15.2. Configurar workflow de build
- [ ] 15.3. Configurar workflow de deploy
- [ ] 15.4. Setup de environments (staging/prod)
- [ ] 15.5. Configurar notificaciones

#### Entregables
```
✓ .github/workflows/test.yml
✓ .github/workflows/build.yml
✓ .github/workflows/deploy.yml
✓ Branch protection rules
✓ Deployment badges
```

#### Workflows

##### Tests
```yaml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup Node
      - Install dependencies
      - Run lint
      - Run tests
      - Upload coverage
```

##### Deploy
```yaml
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup Fly CLI
      - Deploy to Fly.io
      - Run smoke tests
      - Notify team
```

#### Checklist de Verificación
- [ ] Tests corren en CI
- [ ] Deploy automático funciona
- [ ] Coverage reporta correctamente
- [ ] Branch protection activo
- [ ] Notificaciones configuradas
- [ ] Rollback strategy definida

---

### **MÓDULO 16: Documentación y Capacitación**
**Duración:** 4-5 horas
**Prioridad:** 🟢 MEDIA
**Dependencias:** MÓDULO 15

#### Tareas
- [ ] 16.1. Documentar API (OpenAPI)
- [ ] 16.2. Crear manual de usuario
- [ ] 16.3. Crear guía de operación
- [ ] 16.4. Documentar troubleshooting
- [ ] 16.5. Crear materiales de capacitación

#### Entregables
```
✓ docs/api-specification.yaml
✓ docs/user-manual.md
✓ docs/operational-guide.md
✓ docs/troubleshooting.md
✓ docs/training-materials/
```

#### Documentos Requeridos

##### API Documentation
- OpenAPI 3.0 specification
- Ejemplos de requests/responses
- Códigos de error
- Rate limiting rules

##### Manual de Usuario
- Guía de instalación PWA
- Cómo escanear vouchers
- Manejo de modo offline
- Resolución de conflictos

##### Guía Operativa
- Inicio/parada del sistema
- Monitoreo básico
- Backup y restore
- Escalamiento

##### Troubleshooting
- Problemas comunes
- Logs importantes
- Contactos de soporte
- FAQs

#### Checklist de Verificación
- [ ] API documentada completamente
- [ ] Manuales fáciles de seguir
- [ ] Screenshots incluidos
- [ ] Videos tutoriales creados
- [ ] FAQs completos
- [ ] Documentación versionada

---

### **MÓDULO 17: Monitoreo y Observabilidad**
**Duración:** 3-4 horas
**Prioridad:** 🟢 MEDIA
**Dependencias:** MÓDULO 14

#### Tareas
- [ ] 17.1. Configurar métricas de aplicación
- [ ] 17.2. Setup de health checks
- [ ] 17.3. Configurar alertas
- [ ] 17.4. Dashboard de monitoreo
- [ ] 17.5. Log aggregation

#### Entregables
```
✓ Health check endpoint
✓ Métricas exportadas
✓ Alertas configuradas
✓ Dashboard básico
✓ Log rotation configurado
```

#### Métricas Clave (SLIs)
```javascript
Uptime: >99.9%
Response time p95: <500ms
Error rate: <1%
Redemption success rate: >95%
Sync latency: <5s
```

#### Alertas Críticas
```
- API down (uptime < 99%)
- High error rate (>5%)
- Database issues
- Sync failures (>10)
- Disk space low (<20%)
```

#### Checklist de Verificación
- [ ] Health checks funcionan
- [ ] Métricas se exportan
- [ ] Alertas se disparan
- [ ] Dashboard accesible
- [ ] Logs rotando correctamente
- [ ] Retention policy configurado

---

## 📊 CRONOGRAMA GENERAL

### **SPRINT 1: Fundación (Semana 1)**
**Objetivo:** Backend core funcional

| Día | Módulos | Horas | Estado |
|-----|---------|-------|--------|
| 1-2 | 0, 1, 2 | 12-16h | ⏸️ |
| 3-4 | 3, 4 | 12-15h | ⏸️ |
| 5-7 | 5, 6 | 10-13h | ⏸️ |

**Entregables:**
- ✓ Backend API completo
- ✓ Base de datos configurada
- ✓ Tests unitarios básicos

---

### **SPRINT 2: Frontend PWA (Semana 2)**
**Objetivo:** PWA offline-first funcional

| Día | Módulos | Horas | Estado |
|-----|---------|-------|--------|
| 1-2 | 7, 8 | 11-14h | ⏸️ |
| 3-4 | 9, 10 | 10-14h | ⏸️ |
| 5-7 | Integración | 8-10h | ⏸️ |

**Entregables:**
- ✓ PWA instalable
- ✓ Modo offline completo
- ✓ Sincronización funcional

---

### **SPRINT 3: Testing y QA (Semana 3)**
**Objetivo:** Coverage >80%, tests E2E

| Día | Módulos | Horas | Estado |
|-----|---------|-------|--------|
| 1-3 | 11, 12 | 14-18h | ⏸️ |
| 4-5 | 13 | 6-8h | ⏸️ |
| 6-7 | Bug fixing | 8-10h | ⏸️ |

**Entregables:**
- ✓ Tests completos
- ✓ Coverage >80%
- ✓ E2E funcionando

---

### **SPRINT 4: Despliegue y Docs (Semana 4)**
**Objetivo:** Production-ready en Fly.io

| Día | Módulos | Horas | Estado |
|-----|---------|-------|--------|
| 1-2 | 14, 15 | 7-10h | ⏸️ |
| 3-4 | 16, 17 | 7-9h | ⏸️ |
| 5-7 | Capacitación | 8-10h | ⏸️ |

**Entregables:**
- ✓ App en producción
- ✓ CI/CD activo
- ✓ Documentación completa
- ✓ Personal capacitado

---

## ✅ CHECKLIST MAESTRO DE VERIFICACIÓN

### Pre-Despliegue (Must-Have)
- [ ] Todos los tests pasan (unit, integration, e2e)
- [ ] Coverage >80%
- [ ] Test Case #10 (CSV reconciliation) implementado
- [ ] HMAC signing funciona correctamente
- [ ] Zona horaria Argentina configurada
- [ ] Transacciones atómicas validadas
- [ ] Rate limiting activo
- [ ] CORS configurado
- [ ] Secrets en variables de entorno
- [ ] PWA instala correctamente
- [ ] Modo offline funcional
- [ ] Sincronización automática funciona
- [ ] Service Worker registrado
- [ ] Health check responde
- [ ] Logs estructurados en JSON

### Despliegue (Critical)
- [ ] Fly.io app creada
- [ ] Volume para datos configurado
- [ ] Secrets configurados
- [ ] Deploy exitoso
- [ ] Smoke tests pasan
- [ ] DNS configurado (si aplica)
- [ ] SSL activo
- [ ] Monitoring activo
- [ ] Backups configurados
- [ ] Rollback strategy probada

### Post-Despliegue (Validation)
- [ ] API accesible públicamente
- [ ] PWA instala desde dominio
- [ ] Login funciona
- [ ] Emisión de vouchers funciona
- [ ] Canje online funciona
- [ ] Canje offline funciona
- [ ] Sincronización funciona
- [ ] Reportes generan correctamente
- [ ] Performance aceptable (<500ms p95)
- [ ] No memory leaks
- [ ] Logs visibles en Fly.io
- [ ] Alertas funcionan

---

## 🎯 MÉTRICAS DE ÉXITO

### Técnicas
```
✓ Setup time: <1 hora
✓ Build time: <5 minutos
✓ Deploy time: <3 minutos
✓ Test suite: <2 minutos
✓ Code coverage: >80%
✓ Lighthouse score: >90
✓ Bundle size: <500KB
```

### Funcionales
```
✓ Uptime: >99.9%
✓ API latency p95: <500ms
✓ Redemption success: >95%
✓ Offline capability: 100%
✓ Sync latency: <5s
✓ Conflict rate: <5%
✓ Error rate: <1%
```

### Negocio
```
✓ Reducción papel: 100%
✓ Ahorro anual: $500+ USD
✓ Prevención fraude: $1,200+ USD
✓ Tiempo reconciliación: -40%
✓ Satisfacción usuario: >4.5/5
✓ Adopción sistema: >90%
✓ ROI: Positivo en 3 meses
```

---

## 🚨 RIESGOS Y MITIGACIONES

### Alto Riesgo
| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Duplicación de canjes | Media | Crítico | UNIQUE constraint + tests exhaustivos |
| Pérdida de datos offline | Baja | Crítico | IndexedDB + sync robusto + tests |
| Problemas de zona horaria | Media | Alto | Configuración TZ + tests específicos |
| Fallos en sincronización | Media | Alto | Retry logic + conflict resolution |

### Medio Riesgo
| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Performance lento | Media | Medio | Caching + optimization + monitoring |
| Adopción usuario baja | Baja | Medio | Capacitación + UX simple |
| Problemas de red | Alta | Bajo | Modo offline + PWA |
| Bugs en producción | Media | Medio | Tests + CI/CD + rollback |

---

## 📚 RECURSOS Y REFERENCIAS

### Documentación Técnica
- [Documento Base Completo](./DOC_UNICA_BASE_SIST_VOUCHERS_HOTEL.txt)
- [Arquitectura Hexagonal](https://alistair.cockburn.us/hexagonal-architecture/)
- [PWA Best Practices](https://web.dev/progressive-web-apps/)
- [SQLite WAL Mode](https://www.sqlite.org/wal.html)

### Herramientas
- [Fly.io Docs](https://fly.io/docs/)
- [Express.js](https://expressjs.com/)
- [React PWA](https://create-react-app.dev/docs/making-a-progressive-web-app/)
- [Better SQLite3](https://github.com/WiseLibs/better-sqlite3)

### Testing
- [Jest](https://jestjs.io/)
- [Supertest](https://github.com/visionmedia/supertest)
- [Playwright](https://playwright.dev/)

---

## 🎓 NOTAS FINALES

### Filosofía de Desarrollo
1. **Fail-Fast**: Validaciones tempranas
2. **Offline-First**: Funcionar sin red
3. **ACID Compliance**: Transacciones atómicas
4. **Security by Design**: Seguridad desde el inicio
5. **Observable**: Logs y métricas siempre
6. **Modular**: Componentes independientes
7. **Testable**: >80% coverage mínimo

### Principios SOLID
- **S**ingle Responsibility: Cada clase/función una responsabilidad
- **O**pen/Closed: Abierto extensión, cerrado modificación
- **L**iskov Substitution: Interfaces intercambiables
- **I**nterface Segregation: Interfaces específicas
- **D**ependency Inversion: Depender de abstracciones

### Clean Code
- Nombres descriptivos
- Funciones pequeñas (<50 líneas)
- Comentarios solo cuando necesario
- DRY (Don't Repeat Yourself)
- Error handling explícito
- Tests como documentación

---

## 📞 SOPORTE Y CONTACTO

### Issues GitHub
Para reportar bugs o solicitar features:
https://github.com/eevans-d/SIST_VOUCHERS_HOTEL/issues

### Estructura de Issue
```markdown
## Descripción
[Descripción clara del problema/feature]

## Pasos para Reproducir
1. ...
2. ...

## Comportamiento Esperado
[Qué debería pasar]

## Comportamiento Actual
[Qué está pasando]

## Environment
- OS: [Linux/Mac/Windows]
- Node: [versión]
- Browser: [navegador + versión]

## Logs
```
[Logs relevantes]
```
```

---

## 📄 LICENCIA Y ATRIBUCIONES

**Proyecto:** Sistema Vouchers Digitales  
**Cliente:** Hostal Playa Norte  
**Desarrollo:** [Tu Nombre/Empresa]  
**Licencia:** Propietaria  
**Versión Documento:** 1.0.0  
**Fecha:** 21 de Octubre, 2025

---

**🚀 ¡Adelante con el desarrollo! Este sistema liberará espíritus hacia horizontes digitales infinitos.**

---

## PRÓXIMOS PASOS INMEDIATOS

1. ✅ Revisar y aprobar esta planificación
2. ⏸️ Ejecutar MÓDULO 0 (Preparación del Entorno)
3. ⏸️ Ejecutar MÓDULO 1 (Base de Datos)
4. ⏸️ Continuar secuencialmente según roadmap

**¿Comenzamos con el MÓDULO 0?**
