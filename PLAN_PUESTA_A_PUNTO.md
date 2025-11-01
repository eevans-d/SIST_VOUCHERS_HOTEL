# 🎯 PLAN DE PUESTA A PUNTO PRE-DESPLIEGUE
## Opción C: Profesional - Cero Riesgo

**Objetivo:** Resolver TODOS los bloqueantes identificados en auditoría antes de despliegue  
**Timeline:** 9.5 semanas (~380 horas)  
**Estrategia:** Sistemática, paso a paso, con validación continua  
**Estado:** 🚀 EN EJECUCIÓN

---

## 📊 MÉTRICAS OBJETIVO

| Métrica | Actual | Objetivo | Gap |
|---------|--------|----------|-----|
| Test Coverage | 14.51% | 90% | +75.49% |
| Tests Passing | 154/187 (82.4%) | 187/187 (100%) | +33 tests |
| ESLint Errors | 199 | 0 | -199 |
| OWASP Tests | 0 | 10 suites | +10 |
| Load Tests | 0 | 1 suite k6 | +1 |
| Staging Env | ❌ | ✅ | Crear |
| Frontend Tests | 0% | 80% | +80% |
| Memory Usage | 90% | <70% | -20% |

---

## 📋 CHECKLIST MAESTRA - 50 TAREAS

### 🔴 FASE 1: LIMPIEZA Y PREPARACIÓN (8 horas)

#### Semana 1 - Días 1-2

- [ ] **1.1** Fix automático ESLint (2h)
  - [ ] Ejecutar `npm run format` en backend
  - [ ] Ejecutar `npm run lint -- --fix`
  - [ ] Revisar y corregir manualmente errores restantes
  - [ ] Validar: 0 errores ESLint

- [ ] **1.2** Configurar Husky pre-commit hooks (1h)
  - [ ] Instalar y configurar husky
  - [ ] Hook: lint-staged para ESLint automático
  - [ ] Hook: tests unitarios antes de commit
  - [ ] Validar: hook funciona correctamente

- [ ] **1.3** Limpiar código muerto - Fase 1 (3h)
  - [ ] Auditar imports de servicios en /services/
  - [ ] Identificar servicios sin uso (grep en codebase)
  - [ ] Crear carpeta /services/experimental
  - [ ] Mover servicios no usados a experimental/
  - [ ] Actualizar documentación
  - [ ] Validar: build exitoso sin errores

- [ ] **1.4** Crear .gitignore mejorado (30min)
  - [ ] Agregar coverage/ a .gitignore
  - [ ] Agregar .env.local
  - [ ] Agregar node_modules/
  - [ ] Limpiar archivos trackeados innecesarios

- [ ] **1.5** Actualizar dependencias (1.5h)
  - [ ] Revisar `npm outdated` backend
  - [ ] Actualizar dependencias menores
  - [ ] Ejecutar `npm audit fix`
  - [ ] Ejecutar tests para validar
  - [ ] Repetir para frontend

**Checkpoint 1:** ✅ Código limpio, linters OK, deps actualizadas

---

### 🟡 FASE 2: INFRAESTRUCTURA DE TESTING (16 horas)

#### Semana 1 - Días 3-5

- [ ] **2.1** Configurar Jest mejorado (2h)
  - [ ] Configurar jest.config.js con coverage thresholds
  - [ ] Configurar test:watch script
  - [ ] Configurar test:debug script
  - [ ] Agregar reporter de coverage mejorado

- [ ] **2.2** Crear helpers de testing (3h)
  - [ ] `tests/helpers/database.js` - DB en memoria para tests
  - [ ] `tests/helpers/fixtures.js` - Datos de prueba
  - [ ] `tests/helpers/auth.js` - Helpers de autenticación
  - [ ] `tests/helpers/assertions.js` - Custom matchers
  - [ ] Documentar uso en README

- [ ] **2.3** Setup Frontend Testing (4h)
  - [ ] Configurar Vitest
  - [ ] Instalar @testing-library/react
  - [ ] Crear tests/setup.js
  - [ ] Configurar coverage frontend
  - [ ] Test básico de App.jsx funcionando

- [ ] **2.4** CI/CD Pipeline - Testing (4h)
  - [ ] Crear .github/workflows/test.yml
  - [ ] Job: lint (backend + frontend)
  - [ ] Job: unit tests con coverage
  - [ ] Job: integration tests
  - [ ] Job: upload coverage a Codecov
  - [ ] Badge en README.md

- [ ] **2.5** Configurar test database (3h)
  - [ ] Script para crear test.db
  - [ ] Seed data para tests
  - [ ] Cleanup automático entre tests
  - [ ] Documentar en tests/README.md

**Checkpoint 2:** ✅ Infraestructura testing completa y automatizada

---

### 🔴 FASE 3: TESTS DE SEGURIDAD (40 horas)

#### Semana 2

- [ ] **3.1** OWASP #1 - Injection (8h)
  - [ ] Test: SQL Injection en login
  - [ ] Test: SQL Injection en búsquedas
  - [ ] Test: NoSQL Injection (si aplica)
  - [ ] Test: Command Injection
  - [ ] Test: LDAP Injection
  - [ ] Implementar sanitización si falla
  - [ ] Validar: 100% tests pasan

- [ ] **3.2** OWASP #2 - Broken Authentication (8h)
  - [ ] Test: JWT expiration
  - [ ] Test: Token refresh security
  - [ ] Test: Brute force protection
  - [ ] Test: Password strength enforcement
  - [ ] Test: Session fixation
  - [ ] Test: Concurrent sessions
  - [ ] Implementar mejoras si necesario

- [ ] **3.3** OWASP #3 - Sensitive Data Exposure (6h)
  - [ ] Test: Passwords nunca en response
  - [ ] Test: Secrets no en logs
  - [ ] Test: HTTPS enforcement
  - [ ] Test: Secure cookies
  - [ ] Test: PII encryption at rest
  - [ ] Implementar cifrado si necesario

- [ ] **3.4** OWASP #4-7 (10h)
  - [ ] Test: XXE (XML External Entities)
  - [ ] Test: Broken Access Control
  - [ ] Test: Security Misconfiguration
  - [ ] Test: XSS (Cross-Site Scripting)
  - [ ] Implementar sanitización HTML
  - [ ] Implementar CSP headers

- [ ] **3.5** OWASP #8-10 (8h)
  - [ ] Test: Insecure Deserialization
  - [ ] Test: Known Vulnerabilities (npm audit)
  - [ ] Test: Insufficient Logging
  - [ ] Implementar logging security events
  - [ ] Crear dashboard de security events

**Checkpoint 3:** ✅ 100% OWASP Top 10 validado y tests passing

---

### 🟡 FASE 4: TESTS UNITARIOS - COBERTURA (80 horas)

#### Semanas 3-4

- [ ] **4.1** Domain Entities (16h)
  - [ ] User.test.js - 95% coverage
  - [ ] Voucher.test.js - 95% coverage
  - [ ] Order.test.js - 95% coverage
  - [ ] Stay.test.js - 95% coverage
  - [ ] Tests de validación
  - [ ] Tests de edge cases
  - [ ] Tests de serialización

- [ ] **4.2** Use Cases Críticos (24h)
  - [ ] LoginUser.test.js - 90% coverage
  - [ ] RegisterUser.test.js - 90% coverage
  - [ ] GenerateVoucher.test.js - 90% coverage
  - [ ] ValidateVoucher.test.js - 90% coverage
  - [ ] RedeemVoucher.test.js - 90% coverage
  - [ ] CreateOrder.test.js - 90% coverage
  - [ ] CompleteOrder.test.js - 90% coverage
  - [ ] CreateStay.test.js - 90% coverage

- [ ] **4.3** Repositories (20h)
  - [ ] UserRepository.test.js - 85% coverage
  - [ ] VoucherRepository.test.js - 85% coverage
  - [ ] OrderRepository.test.js - 85% coverage
  - [ ] StayRepository.test.js - 85% coverage
  - [ ] Tests de queries complejas
  - [ ] Tests de transacciones
  - [ ] Tests de constraints

- [ ] **4.4** Middlewares (12h)
  - [ ] auth.middleware.test.js - 95% coverage
  - [ ] rateLimiter.middleware.test.js - 95% coverage
  - [ ] errorHandler.test.js - 90% coverage
  - [ ] metrics.test.js - 85% coverage
  - [ ] security.test.js - 95% coverage
  - [ ] correlation.test.js - 80% coverage

- [ ] **4.5** Services (8h)
  - [ ] JWTService.test.js - 90% coverage
  - [ ] PasswordService.test.js - 90% coverage
  - [ ] CryptoService.test.js - 95% coverage
  - [ ] QRService.test.js - 85% coverage
  - [ ] ReportService.test.js - 80% coverage

**Checkpoint 4:** ✅ 90% coverage backend alcanzado

---

### 🔴 FASE 5: TESTS DE INTEGRACIÓN (32 horas)

#### Semana 5

- [ ] **5.1** Flujo Autenticación (8h)
  - [ ] Test: Register → Login → Refresh
  - [ ] Test: Login con credenciales inválidas
  - [ ] Test: Token expiration flow
  - [ ] Test: Logout y blacklist
  - [ ] Test: Concurrent logins

- [ ] **5.2** Flujo Vouchers (12h)
  - [ ] Test: Create Stay → Generate Vouchers
  - [ ] Test: Validate Voucher → Redeem
  - [ ] Test: Double redemption prevention
  - [ ] Test: Voucher expiration
  - [ ] Test: Cancel voucher
  - [ ] Test: Voucher con QR corruption

- [ ] **5.3** Flujo Orders (8h)
  - [ ] Test: Create Order → Add Items → Complete
  - [ ] Test: Apply discount codes
  - [ ] Test: Payment flow
  - [ ] Test: Cancel order
  - [ ] Test: Order con items inválidos

- [ ] **5.4** Flujo Reports (4h)
  - [ ] Test: Generate vouchers report
  - [ ] Test: Generate orders report
  - [ ] Test: Generate dashboard
  - [ ] Test: Export CSV

**Checkpoint 5:** ✅ Todos los flujos E2E validados

---

### 🟡 FASE 6: TESTS DE CARGA Y CAOS (24 horas)

#### Semana 6

- [ ] **6.1** Setup k6 (4h)
  - [ ] Instalar k6
  - [ ] Crear load-test-k6.js completo
  - [ ] Configurar scenarios
  - [ ] Configurar thresholds
  - [ ] Documentar en README

- [ ] **6.2** Load Tests - Ramp Up (8h)
  - [ ] Test: 10 usuarios concurrentes (baseline)
  - [ ] Test: 50 usuarios concurrentes
  - [ ] Test: 100 usuarios concurrentes
  - [ ] Test: 200 usuarios concurrentes
  - [ ] Analizar resultados
  - [ ] Identificar cuellos de botella

- [ ] **6.3** Soak Testing (4h)
  - [ ] Test: 50 usuarios durante 2 horas
  - [ ] Monitorear memory leaks
  - [ ] Monitorear CPU usage
  - [ ] Analizar degradación

- [ ] **6.4** Spike Testing (4h)
  - [ ] Test: 0 → 200 usuarios en 10s
  - [ ] Test: Recuperación post-spike
  - [ ] Validar rate limiting

- [ ] **6.5** Chaos Engineering (4h)
  - [ ] Test: Matar DB connection
  - [ ] Test: Latencia extrema (>30s)
  - [ ] Test: Respuestas malformadas
  - [ ] Test: Disk full
  - [ ] Validar graceful degradation

**Checkpoint 6:** ✅ Sistema validado bajo carga y caos

---

### 🔴 FASE 7: FRONTEND TESTING (80 horas)

#### Semanas 7-8

- [ ] **7.1** Components Tests (24h)
  - [ ] ErrorBoundary.test.jsx
  - [ ] LazyLoadErrorBoundary.test.jsx
  - [ ] LoadingFallback.test.jsx
  - [ ] ErrorScreens.test.jsx
  - [ ] Cobertura: 90%

- [ ] **7.2** Pages Tests (32h)
  - [ ] LoginPage.test.jsx
  - [ ] DashboardPage.test.jsx
  - [ ] VouchersPage.test.jsx
  - [ ] OrdersPage.test.jsx
  - [ ] User interactions
  - [ ] Form validation
  - [ ] Error handling

- [ ] **7.3** Services Tests (12h)
  - [ ] api.test.js
  - [ ] Interceptors tests
  - [ ] Token refresh tests
  - [ ] Error handling tests

- [ ] **7.4** Store Tests (8h)
  - [ ] useAuth.test.js
  - [ ] useVouchers.test.js
  - [ ] useOrders.test.js
  - [ ] useReports.test.js

- [ ] **7.5** E2E Frontend (4h)
  - [ ] Playwright setup
  - [ ] Login flow E2E
  - [ ] Create voucher flow E2E
  - [ ] Create order flow E2E

**Checkpoint 7:** ✅ 80% coverage frontend alcanzado

---

### 🟡 FASE 8: OPTIMIZACIÓN Y HARDENING (40 horas)

#### Semana 9 - Días 1-3

- [ ] **8.1** Memory Optimization (16h)
  - [ ] Profiling con Chrome DevTools
  - [ ] Identificar memory leaks
  - [ ] Implementar LRU cache con límites
  - [ ] Implementar garbage collection manual
  - [ ] Validar: memory <70%

- [ ] **8.2** Circuit Breakers (8h)
  - [ ] Implementar CircuitBreaker class
  - [ ] Aplicar a servicios críticos
  - [ ] Tests de circuit breaker
  - [ ] Configurar thresholds
  - [ ] Dashboard de circuit state

- [ ] **8.3** Distributed Tracing (8h)
  - [ ] Implementar tracing middleware
  - [ ] Configurar Jaeger (opcional)
  - [ ] Trace IDs en logs
  - [ ] Span IDs en responses
  - [ ] Documentar uso

- [ ] **8.4** Alerting (4h)
  - [ ] Configurar alertas Prometheus
  - [ ] Alertas: error rate >5%
  - [ ] Alertas: latency P95 >1s
  - [ ] Alertas: memory >80%
  - [ ] Alertas: disk >90%

- [ ] **8.5** Rate Limiting Avanzado (4h)
  - [ ] Rate limiting por IP + User
  - [ ] Whitelist IPs confiables
  - [ ] Blacklist IPs maliciosos
  - [ ] Tests de bypass prevention

**Checkpoint 8:** ✅ Sistema optimizado y hardened

---

### 🔴 FASE 9: STAGING Y VALIDACIÓN (24 horas)

#### Semana 9 - Días 4-5

- [ ] **9.1** Crear Staging Environment (8h)
  - [ ] Crear app Fly.io staging
  - [ ] Configurar fly.staging.toml
  - [ ] Copiar secrets a staging
  - [ ] Deploy a staging
  - [ ] Validar health checks

- [ ] **9.2** Smoke Tests en Staging (4h)
  - [ ] Ejecutar smoke-check.sh
  - [ ] Validar todos los endpoints
  - [ ] Validar métricas
  - [ ] Validar logs

- [ ] **9.3** Integration Tests Staging (8h)
  - [ ] Ejecutar integration-test.sh
  - [ ] Tests E2E con Playwright
  - [ ] Load tests k6 en staging
  - [ ] Analizar resultados

- [ ] **9.4** Security Audit Staging (4h)
  - [ ] Scan con OWASP ZAP
  - [ ] Vulnerability scan
  - [ ] SSL/TLS check
  - [ ] Headers check
  - [ ] Análisis de resultados

**Checkpoint 9:** ✅ Staging 100% funcional y validado

---

### 🟡 FASE 10: DOCUMENTACIÓN Y RUNBOOKS (16 horas)

#### Semana 10 - Días 1-2

- [ ] **10.1** Actualizar Documentación Técnica (6h)
  - [ ] Actualizar README.md
  - [ ] Actualizar DEPLOYMENT.md
  - [ ] Documentar tests en tests/README.md
  - [ ] Documentar arquitectura
  - [ ] Diagramas actualizados

- [ ] **10.2** Crear Runbooks (6h)
  - [ ] Runbook: Incident response
  - [ ] Runbook: Deployment process
  - [ ] Runbook: Rollback process
  - [ ] Runbook: Backup & restore
  - [ ] Runbook: Scaling

- [ ] **10.3** Disaster Recovery Plan (4h)
  - [ ] Plan de backup automático
  - [ ] Plan de restore
  - [ ] RTO y RPO definidos
  - [ ] Tests de DR
  - [ ] Documentar en DR.md

**Checkpoint 10:** ✅ Documentación completa y profesional

---

### 🔴 FASE 11: PRE-DEPLOYMENT FINAL (12 horas)

#### Semana 10 - Día 3

- [ ] **11.1** Dry-run Deployment (4h)
  - [ ] Practicar deployment completo
  - [ ] Timing de cada paso
  - [ ] Validar rollback
  - [ ] Documentar lecciones

- [ ] **11.2** Team Briefing (2h)
  - [ ] Sesión con equipo
  - [ ] Revisar runbooks
  - [ ] Asignar roles (DRI)
  - [ ] Plan de comunicación

- [ ] **11.3** Go/No-Go Meeting (2h)
  - [ ] Revisar checklist completo
  - [ ] Revisar métricas
  - [ ] Validar criterios de éxito
  - [ ] Decisión final

- [ ] **11.4** Final Checks (4h)
  - [ ] Ejecutar todos los tests
  - [ ] Validar staging
  - [ ] Verificar secrets prod
  - [ ] Backup de prod actual
  - [ ] Comunicar a stakeholders

**Checkpoint 11:** ✅ Listo para PRODUCCIÓN

---

### 🟢 FASE 12: DEPLOYMENT Y MONITORING (8 horas)

#### Semana 10 - Día 4

- [ ] **12.1** Deploy Backend (2h)
  - [ ] Deploy a producción
  - [ ] Validar health checks
  - [ ] Smoke tests
  - [ ] Monitorear métricas

- [ ] **12.2** Deploy Frontend (2h)
  - [ ] Deploy frontend
  - [ ] Validar CORS
  - [ ] Smoke tests frontend
  - [ ] Validar integración

- [ ] **12.3** Post-Deploy Validation (2h)
  - [ ] Integration tests producción
  - [ ] Load tests light
  - [ ] Validar todos los flujos

- [ ] **12.4** Monitoring Intensivo (2h)
  - [ ] Monitoring 24/7 primeras 48h
  - [ ] Dashboard en vivo
  - [ ] Alertas activas
  - [ ] Team on-call

**Checkpoint 12:** ✅ PRODUCCIÓN EXITOSA

---

## 📊 CRITERIOS DE ÉXITO FINALES

Al completar todas las fases, el sistema debe cumplir:

- [x] ✅ Test coverage backend: **>90%**
- [x] ✅ Test coverage frontend: **>80%**
- [x] ✅ Tests passing: **187/187 (100%)**
- [x] ✅ ESLint errors: **0**
- [x] ✅ OWASP Top 10: **100% validado**
- [x] ✅ Load tests: **P95 <500ms con 100 usuarios**
- [x] ✅ Memory usage: **<70%**
- [x] ✅ Staging environment: **✅ Funcional**
- [x] ✅ Circuit breakers: **✅ Implementados**
- [x] ✅ Distributed tracing: **✅ Activo**
- [x] ✅ Documentación: **100% completa**
- [x] ✅ Runbooks: **✅ Creados y validados**

---

## 🎯 RESUMEN EJECUTIVO

| Fase | Tiempo | Tareas | Estado |
|------|--------|--------|--------|
| 1. Limpieza | 8h | 5 | ⏳ Pendiente |
| 2. Infraestructura Testing | 16h | 5 | ⏳ Pendiente |
| 3. Tests Seguridad | 40h | 5 | ⏳ Pendiente |
| 4. Tests Unitarios | 80h | 5 | ⏳ Pendiente |
| 5. Tests Integración | 32h | 4 | ⏳ Pendiente |
| 6. Tests Carga | 24h | 5 | ⏳ Pendiente |
| 7. Frontend Tests | 80h | 5 | ⏳ Pendiente |
| 8. Optimización | 40h | 5 | ⏳ Pendiente |
| 9. Staging | 24h | 4 | ⏳ Pendiente |
| 10. Documentación | 16h | 3 | ⏳ Pendiente |
| 11. Pre-Deploy | 12h | 4 | ⏳ Pendiente |
| 12. Deployment | 8h | 4 | ⏳ Pendiente |
| **TOTAL** | **380h** | **50** | **0/50** |

---

## 📝 SIGUIENTES PASOS INMEDIATOS

1. ✅ Revisar y aprobar este plan
2. ⏭️ Comenzar FASE 1 - Tarea 1.1
3. ⏭️ Ejecutar sistemáticamente cada checklist
4. ⏭️ Validar checkpoints después de cada fase
5. ⏭️ Ajustar timeline si necesario

---

**Preparado por:** Sistema Experto IA  
**Fecha:** 2025-11-01  
**Aprobado por:** [Pendiente]  
**Inicio ejecución:** [Ahora]

---

## 🚀 COMENZAR EJECUCIÓN

**¿Listo para comenzar con FASE 1 - Tarea 1.1?**

Responde "EJECUTAR" para comenzar la implementación sistemática.
