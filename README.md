# 🏨 Sistema de Vouchers - Hostal Playa Norte

> Backend de gestión de vouchers, estadías y cafetería hotelera

![Status](https://img.shields.io/badge/status-pre--production-blue)
![Tests](https://img.shields.io/badge/tests-325%2F327%20passing-brightgreen)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

---

## 📊 Estado Actual (9 nov 2025)

- Backend: FUNCIONAL y estable (99.4% tests passing)
- Frontend: NO implementado (pendiente decisión)
- Deployment: Solo LOCAL (listo tras migración a PostgreSQL)

Notas:
- No hay despliegue activo ni URLs públicas.
- La documentación obsoleta fue archivada en `_archive/docs-obsoletas-nov-2025/`.

---

## ✅ Módulos Implementados

- Autenticación: JWT (access/refresh), RBAC (admin/recepcionista/usuario)
- Estadías: CRUD, activar/completar, filtros, ocupación
- Vouchers: emisión HMAC, validación, redención, cancelación, QR
- Órdenes (Cafetería): CRUD items, completar/cancelar, estadísticas
- Reportes: ocupación, vouchers, consumo, revenue, dashboard

Infraestructura:
- Health checks (`/health`, `/live`, `/ready`), logging (Winston), rate limiting, CORS configurable
- Arquitectura DDD/Clean (entities con Zod, use-cases, repositories, services)

---

## 🚀 Quick Start (Local)

Requisitos: Node.js 18+, npm 9+

```bash
# 1) Backend (desarrollo)
cd vouchers-hostal-playa-norte/backend
npm install
cp .env.example .env  # completa valores locales
npm run dev            # http://localhost:3000

# 2) Tests
npm run test:core   # 79/79 (100%)
npm run test:unit   # 200/202 (~99%)

# 3) E2E (Playwright)
cd e2e
npm install
npm run test:e2e    # 46/46 (100%)
```

---

## 🧪 Estado de Testing

- Core: 7/7 suites, 79/79 tests PASS (100%)
- E2E: 46/46 tests PASS (chromium + firefox)
- Unit: 14/15 suites, 200/202 tests PASS (~99%)

Total: 325/327 tests PASANDO (99.4%)

---

## 🛣️ Camino a Producción

Bloqueadores:
1) Migración a PostgreSQL (4-6h)
2) Elegir plataforma y desplegar (2-4h)
3) Secrets management (1-2h)

Opcional: Frontend (40-60h) o API-only con OpenAPI/Postman (2-3h)

Consulta el blueprint completo en `PRODUCTION_ROADMAP.md`.

---

## 📁 Estructura (resumen)

```
SIST_VOUCHERS_HOTEL/
├─ PRODUCTION_ROADMAP.md
├─ README.md
├─ _archive/
└─ vouchers-hostal-playa-norte/
   └─ backend/
      ├─ src/ (domain, application, infrastructure, presentation)
      ├─ tests/ (core, unit, __skip__ legacy)
      ├─ e2e/ (Playwright)
      ├─ jest.config.js
      └─ package.json
```

---

## 📚 Documentación

- Blueprint a producción: `PRODUCTION_ROADMAP.md`
- Backend: `vouchers-hostal-playa-norte/backend/README.md`
- E2E: `vouchers-hostal-playa-norte/backend/e2e/README.md`
- Tests legacy skip: `vouchers-hostal-playa-norte/backend/tests/unit/__skip__/README.md`

---

## 📌 Decisiones Pendientes

- ¿Backend solo (API) o Backend + Frontend?
- ¿Plataforma de deployment? (Railway/Render/Fly.io)
- ¿Presupuesto mensual? (~$10–20/mes)
- ¿Proveedor PostgreSQL? (Railway/Supabase/Render)

---

Licencia: MIT  
Última actualización: 9 nov 2025
