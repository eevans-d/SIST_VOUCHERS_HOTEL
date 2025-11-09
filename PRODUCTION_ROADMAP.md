# 🚀 PRODUCTION ROADMAP - Sistema Vouchers Hotel

> **Blueprint definitivo hacia producción** | Actualizado: 9 nov 2025

---

## 📊 ESTADO ACTUAL REAL

### ✅ Backend - FUNCIONAL Y ESTABLE

**Stack**:
- Node.js 18+ | Express 4.x | ESM modules
- SQLite (better-sqlite3) | Zod validation
- Arquitectura: DDD/Clean (entities, use-cases, repositories, services)

**Tests**:
- ✅ **Core**: 7/7 suites, 79/79 tests PASS (100%)
- ✅ **E2E**: 46/46 tests PASS (Playwright, chromium + firefox)
- ✅ **Unit**: 14/15 suites, 200/202 tests PASS (99%)
- **Total**: **325/327 tests PASANDO** (99.4% success rate)

**Cobertura**:
- `voucherService`: 93.39% statements, 89.47% branches
- `cryptoService`: 100% statements/branches
- `qrService`: 100% statements/branches
- `reportService`: 100% statements/branches
- `syncService`: 100% statements, 92.3% branches

**Commits recientes**:
- `ee34437` - refactor(tests): skip tests legacy pre-DDD
- `7f8b3bd` - fix(tests): corregir interfaz VoucherService
- `6890f4a` - fix(tests): quick wins ESM migration

**Branch**: `main` sincronizado con `origin/main`

---

## 🎯 FUNCIONALIDADES IMPLEMENTADAS

### Módulo Autenticación ✅
- [x] Registro usuarios (admin, recepcionista, usuario)
- [x] Login con JWT (access + refresh tokens)
- [x] Refresh token automático
- [x] Middleware autenticación/autorización (RBAC)
- [x] Logout con invalidación token

### Módulo Estadías ✅
- [x] Crear estadía (CRUD completo)
- [x] Activar/completar estadía
- [x] Listar estadías con filtros (activas, completadas, por habitación)
- [x] Ocupación hotel (estadísticas en tiempo real)
- [x] Validación Zod entities

### Módulo Vouchers ✅
- [x] Generar vouchers con firma HMAC
- [x] Validar voucher (verificar firma, expiración, estado)
- [x] Redimir voucher (marcar como usado)
- [x] Cancelar voucher
- [x] QR code generation (base64 data URI)
- [x] Estadísticas vouchers (overview, por estado, por período)

### Módulo Órdenes (Cafetería) ✅
- [x] Crear orden (items con cantidad/precio)
- [x] Agregar/actualizar items orden
- [x] Completar orden (marcar como finalizada)
- [x] Cancelar orden
- [x] Estadísticas consumo (revenue diario, items populares)

### Módulo Reportes ✅
- [x] Reporte ocupación (por período, agrupado por día)
- [x] Stats vouchers (totales, agrupados por tipo/estado)
- [x] Reporte consumo cafetería (revenue, items vendidos)
- [x] Revenue diario (consolidado todas las fuentes)
- [x] Dashboard consolidado (métricas generales sistema)

### Infraestructura ✅
- [x] Rate limiting (express-rate-limit, skip en test/E2E)
- [x] CORS configurable por entorno
- [x] Logging estructurado (winston, formato JSON)
- [x] Middleware error handler centralizado
- [x] Health checks (`/health`, `/live`, `/ready`)
- [x] DB migrations con mejor-sqlite3

---

## 🚧 GAPS CRÍTICOS HACIA PRODUCCIÓN

### 🔴 PRIORIDAD ALTA (Blockers producción)

#### 1. Base de Datos Producción
**Estado**: SQLite file-based NO ES APTO PARA PRODUCCIÓN

**Requiere**:
- [ ] Migrar a PostgreSQL (recomendado: Railway, Render, Supabase)
- [ ] Adaptar repositories para usar `pg` en vez de `better-sqlite3`
- [ ] Crear migrations scripts SQL (schema + datos iniciales)
- [ ] Configurar connection pool (`pg.Pool`)
- [ ] Variables entorno: `DATABASE_URL` (PostgreSQL connection string)

**Estimación**: 4-6 horas  
**Riesgo**: ALTO - cambio architectural significativo

#### 2. Secrets Management
**Estado**: Variables sensibles en `.env` local

**Requiere**:
- [ ] Usar secrets manager (Railway Secrets, Render Env, Doppler, etc.)
- [ ] Migrar `JWT_SECRET`, `JWT_REFRESH_SECRET`, `HMAC_SECRET` a secrets
- [ ] Rotar secrets antes de producción (generar nuevos valores seguros)
- [ ] Documentar proceso rotación secrets

**Estimación**: 1-2 horas  
**Riesgo**: MEDIO - exponer secrets = vulnerabilidad crítica

#### 3. Deployment Platform
**Estado**: Backend NO desplegado, código solo local

**Opciones recomendadas**:
- **Railway** (más simple, Postgres incluido, $5/mes)
- **Render** (free tier disponible, Postgres managed)
- **Fly.io** (buena latencia, requiere config inicial)

**Requiere**:
- [ ] Elegir plataforma deployment
- [ ] Crear cuenta y configurar proyecto
- [ ] Configurar variables entorno producción
- [ ] Deploy inicial con healthcheck validation
- [ ] Configurar domain/SSL (opcional)

**Estimación**: 2-4 horas  
**Riesgo**: MEDIO - primera vez puede tener issues de config

#### 4. Frontend
**Estado**: NO EXISTE (solo backend implementado)

**Requiere**:
- [ ] Decidir stack frontend (React, Vue, Next.js, etc.)
- [ ] Implementar interfaz básica (login, dashboard, gestión vouchers)
- [ ] Conectar con backend API
- [ ] Deploy frontend (Vercel, Netlify, Render)

**Estimación**: 40-60 horas (proyecto completo)  
**Riesgo**: ALTO - requiere desarrollo full desde cero

**ALTERNATIVA TEMPORAL**:
- [ ] Generar documentación OpenAPI/Swagger
- [ ] Usar Postman/Insomnia collections
- [ ] Permitir uso directo API REST (sin UI)

---

### 🟡 PRIORIDAD MEDIA (Mejoras pre-producción)

#### 5. Monitoreo y Observabilidad
- [ ] Configurar logging centralizado (Logtail, Papertrail, CloudWatch)
- [ ] Métricas básicas (requests/sec, response time, errores)
- [ ] Alertas críticas (DB down, alta latencia, errores 500)
- [ ] Dashboard básico (Grafana Cloud free tier)

**Estimación**: 3-4 horas

#### 6. Backup y Recuperación
- [ ] Backup automático DB (diario mínimo)
- [ ] Proceso restore documentado y testeado
- [ ] Retention policy (7 días mínimo)

**Estimación**: 2-3 horas

#### 7. Documentación API
- [ ] OpenAPI 3.0 spec completa
- [ ] Ejemplos requests/responses
- [ ] Autenticación flow documentado
- [ ] Postman collection exportada

**Estimación**: 2-3 horas

---

### 🟢 PRIORIDAD BAJA (Post-producción)

#### 8. Performance Optimization
- [ ] Caching (Redis para sessions/vouchers activos)
- [ ] Query optimization (indexes DB)
- [ ] Compression responses (gzip)
- [ ] CDN para assets estáticos

**Estimación**: 4-6 horas

#### 9. Seguridad Avanzada
- [ ] HTTPS enforcement (certificado SSL)
- [ ] Helmet.js configurado completo
- [ ] Content Security Policy (CSP)
- [ ] Audit logs (acciones críticas usuarios)

**Estimación**: 3-4 horas

#### 10. Tests Adicionales
- [ ] Corregir 2 tests fallidos `CompleteOrder.refactor.test.js`
- [ ] Load testing (k6, Artillery)
- [ ] Penetration testing básico

**Estimación**: 2-3 horas

---

## 📋 CHECKLIST MÍNIMO VIABLE PRODUCCIÓN

### Pre-Deployment
- [ ] **DB**: Migrar a PostgreSQL y validar queries
- [ ] **Secrets**: Rotar y configurar en platform secrets
- [ ] **Tests**: Validar 325/327 tests passing
- [ ] **Platform**: Cuenta creada, proyecto configurado
- [ ] **Env vars**: `NODE_ENV=production`, `DATABASE_URL`, secrets

### Deployment
- [ ] Deploy backend a plataforma elegida
- [ ] Healthcheck `/health` responde 200 OK
- [ ] Smoke test manual: login + crear voucher + redimir
- [ ] Verificar logs no muestran errores críticos

### Post-Deployment
- [ ] Configurar backup DB (diario)
- [ ] Monitoreo básico activo (uptime ping)
- [ ] Documentar URLs producción + credenciales admin
- [ ] Plan rollback documentado

---

## 🎯 TIMELINE ESTIMADO A PRODUCCIÓN

### Opción 1: PRODUCCIÓN MÍNIMA (Solo Backend API)
**Tiempo total**: 8-12 horas  
**Requiere**: PostgreSQL + Deployment + Secrets  
**Resultado**: Backend funcional sin UI (uso vía Postman/Swagger)

**Fases**:
1. **DB Migration** (4-6h): PostgreSQL setup + migrations + validación
2. **Deployment Setup** (2-4h): Railway/Render config + deploy + smoke test
3. **Secrets & Security** (1-2h): Rotar secrets + configurar env vars
4. **Validación Final** (1h): Tests E2E contra producción

### Opción 2: PRODUCCIÓN COMPLETA (Backend + Frontend)
**Tiempo total**: 50-70 horas  
**Requiere**: Todo lo anterior + Frontend completo  
**Resultado**: Sistema full-stack funcional

**Fases adicionales**:
1. **Frontend Development** (40-60h): React app completa
2. **Integration** (4-6h): Connect frontend ↔ backend
3. **Frontend Deploy** (2-3h): Vercel/Netlify setup

---

## 🚨 DECISIONES PENDIENTES (Requieren input usuario)

### Críticas
1. **¿Plataforma deployment?** (Railway, Render, Fly.io, otro)
2. **¿Presupuesto hosting?** (free tier vs paid ~$10-20/mes)
3. **¿Frontend necesario YA?** (o puede esperar post-backend)
4. **¿PostgreSQL provider?** (Railway incluido, Supabase free, Render, etc.)

### Opcionales
5. **¿Domain custom?** (ej: api.hostalplayanorte.com vs URL plataforma)
6. **¿Monitoreo pago?** (Datadog, New Relic vs free tier Grafana Cloud)
7. **¿Backups offsite?** (S3, Backblaze B2 vs provider backups)

---

## 📖 DOCUMENTACIÓN CLAVE ACTUAL

### Backend
- `backend/README.md` - Guía principal backend
- `backend/DEPLOYMENT.md` - Instrucciones deployment (OBSOLETO - reemplazar)
- `backend/e2e/README.md` - Suite E2E Playwright
- `backend/tests/unit/__skip__/README.md` - Tests legacy skippeados

### Tests
- Suite core: `npm run test:core` (79 tests, 100% pass)
- Suite E2E: `npm run test:e2e` (46 tests, 100% pass)
- Suite unit: `npm run test:unit` (200 tests, 99% pass)

### Arquitectura
- DDD/Clean: `src/domain/`, `src/application/`, `src/infrastructure/`, `src/presentation/`
- Entities: Zod validation schemas
- Use-cases: Business logic isolated
- Repositories: DB abstraction
- Services: Cross-cutting concerns (crypto, QR, reports, sync)

---

## 🔄 PRÓXIMOS PASOS INMEDIATOS

### Hoy (9 nov 2025)
1. ✅ Limpieza documentación obsoleta
2. ✅ Creación PRODUCTION_ROADMAP.md
3. ⏳ **DECISIÓN**: ¿Opción 1 (backend solo) o Opción 2 (full-stack)?

### Esta Semana
- [ ] Elegir plataforma deployment
- [ ] Migrar a PostgreSQL
- [ ] Deploy backend a producción
- [ ] Smoke test producción

### Próxima Semana
- [ ] Configurar monitoreo básico
- [ ] Documentación API (OpenAPI/Swagger)
- [ ] Backup automatizado
- [ ] (Opcional) Inicio frontend si Opción 2

---

## 📞 SOPORTE Y RECURSOS

### Plataformas Recomendadas
- **Railway**: https://railway.app (PostgreSQL incluido, simple)
- **Render**: https://render.com (free tier DB + backend)
- **Supabase**: https://supabase.com (PostgreSQL gratis, buen dashboard)

### Tutoriales Relevantes
- Node.js + PostgreSQL migration: https://node-postgres.com/
- Railway deployment: https://docs.railway.app/deploy/deployments
- Render deployment: https://render.com/docs/deploy-node-express-app

### Herramientas Testing Producción
- **Postman**: https://postman.com (API testing manual)
- **k6**: https://k6.io (load testing)
- **Uptime Robot**: https://uptimerobot.com (monitoring uptime free)

---

**Estado**: LISTO PARA DEPLOYMENT (pendiente decisiones críticas)  
**Confianza**: ALTA (99.4% tests passing, arquitectura sólida)  
**Riesgo Mayor**: PostgreSQL migration (mitigable con testing exhaustivo)
