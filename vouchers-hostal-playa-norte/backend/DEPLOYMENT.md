# 🚀 Backend Deployment Guide

> Guía completa de deployment del backend en Fly.io

---

## ✅ Status Actual

**Backend en Producción**: https://hpn-vouchers-backend.fly.dev

- ✅ Desplegado en Fly.io (región `gru` - São Paulo)
- ✅ Health checks activos: `/live`, `/ready`, `/health`
- ✅ Métricas Prometheus expuestas: `/api/metrics`
- ✅ Observabilidad: db_errors_total, http_requests_total
- ✅ CORS configurable vía `CORS_ORIGIN`
- ✅ Tests: 154/187 pasando

**Último commit**: `fd04cc5` (deployment validation)

---

## 📋 Pre-requisitos

### 1. Herramientas

```bash
# Fly.io CLI
curl -L https://fly.io/install.sh | sh

# Verificar instalación
flyctl version

# Autenticarse
flyctl auth login
```

### 2. Variables de entorno

Configurar en Fly.io:

```bash
flyctl secrets set \
  NODE_ENV=production \
  JWT_SECRET="<secret-seguro-generado>" \
  CORS_ORIGIN="https://hpn-vouchers-backend.fly.dev,https://hpn-vouchers-frontend.fly.dev" \
  -a hpn-vouchers-backend
```

**Variables disponibles** (ver `.env.example`):
- `NODE_ENV` - Entorno (production/development)
- `PORT` - Puerto interno (default: 3001)
- `JWT_SECRET` - Secret para tokens
- `JWT_EXPIRES_IN` - Expiración tokens (default: 24h)
- `CORS_ORIGIN` - Orígenes permitidos (CSV)
- `LOG_LEVEL` - Nivel de logs (error/warn/info/debug)
- `APP_NAME` - Nombre para métricas
- `APP_VERSION` - Versión para métricas

---

## 🏗️ Arquitectura de Deployment

### Docker

El backend usa **Debian Bookworm Slim** con Node.js 18:

```dockerfile
# Build stage
FROM node:18-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM node:18-bookworm-slim
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3001
CMD ["node", "src/index.js"]
```

### Fly.io Configuration

**fly.toml**:
- App: `hpn-vouchers-backend`
- Región: `gru` (São Paulo)
- VM: `shared-cpu-1x` con 256MB RAM
- Auto-scaling: 1-3 instancias
- Health checks cada 30s

---

## 🚀 Deployment

### Primera vez (ya realizado)

```bash
cd backend

# 1. Crear app
flyctl launch --name hpn-vouchers-backend --region gru --no-deploy

# 2. Configurar secrets
flyctl secrets set NODE_ENV=production JWT_SECRET="..." -a hpn-vouchers-backend

# 3. Deploy
flyctl deploy -a hpn-vouchers-backend
```

### Deploys subsecuentes

```bash
# Opción 1: Deploy directo
flyctl deploy -a hpn-vouchers-backend

# Opción 2: Con build remoto (más rápido)
flyctl deploy --remote-only -a hpn-vouchers-backend

# Opción 3: Forzar rebuild completo
flyctl deploy --remote-only --no-cache -a hpn-vouchers-backend
```

### Validar deployment

```bash
# Script automatizado
./scripts/validate-deploy.sh

# O manualmente:
flyctl status -a hpn-vouchers-backend
flyctl logs -a hpn-vouchers-backend
```

---

## 🔍 Health Checks

### Endpoints disponibles

#### `/live` - Liveness probe
```bash
curl https://hpn-vouchers-backend.fly.dev/live
# Respuesta: {"status":"ok"}
# No valida DB, solo que el proceso está vivo
```

#### `/ready` - Readiness probe
```bash
curl https://hpn-vouchers-backend.fly.dev/ready
# Respuesta: {"status":"ready"} (200) o {"status":"not_ready"} (503)
# Valida que la DB esté accesible
```

#### `/health` - Health detallado
```bash
curl https://hpn-vouchers-backend.fly.dev/health
# Respuesta:
{
  "status": "ok",
  "timestamp": "2025-10-30T...",
  "uptime": 12345,
  "checks": {
    "database": "ok",
    "memory": {"used":"45MB","total":"256MB"}
  }
}
```

#### `/metrics` - Métricas Prometheus
```bash
curl https://hpn-vouchers-backend.fly.dev/metrics
# Métricas expuestas:
# - http_requests_total{method,route,status_code}
# - http_request_duration_seconds{method,route,status_code}
# - http_server_errors_total{route,status_code}
# - db_errors_total{operation,error_code}
# - nodejs_heap_size_total_bytes
# - process_cpu_user_seconds_total
# + más métricas de Node.js
```

---

## 📊 Observabilidad

### Métricas clave

**HTTP Requests**:
```promql
# Tasa de requests
rate(http_requests_total[5m])

# Latencia p95
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Errores 5xx
rate(http_server_errors_total[5m])
```

**Database**:
```promql
# Errores de DB
rate(db_errors_total[5m])

# Por operación
sum by (operation) (db_errors_total)
```

### Logs

```bash
# Logs en vivo
flyctl logs -a hpn-vouchers-backend

# Últimas 100 líneas
flyctl logs -a hpn-vouchers-backend --lines 100

# Filtrar errores
flyctl logs -a hpn-vouchers-backend | grep ERROR
```

### Monitoreo

```bash
# Dashboard web
flyctl dashboard -a hpn-vouchers-backend

# Status continuo
flyctl status -a hpn-vouchers-backend --watch
```

---

## 🔐 CORS Configuration

Después de deployar el frontend, actualizar CORS:

```bash
# Agregar dominio del frontend
flyctl secrets set \
  CORS_ORIGIN="https://hpn-vouchers-backend.fly.dev,https://hpn-vouchers-frontend.fly.dev" \
  -a hpn-vouchers-backend

# Reiniciar para aplicar
flyctl apps restart hpn-vouchers-backend
```

### Validar CORS

```bash
# Preflight request
curl -v \
  -H "Origin: https://hpn-vouchers-frontend.fly.dev" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS \
  https://hpn-vouchers-backend.fly.dev/api/auth/login

# Verificar headers en respuesta:
# Access-Control-Allow-Origin: https://hpn-vouchers-frontend.fly.dev
# Access-Control-Allow-Methods: GET,POST,PUT,DELETE,PATCH
```

---

## 🧪 Testing en Producción

### Smoke test

```bash
# Script automatizado
./scripts/smoke-check.sh

# Tests incluidos:
# ✅ /live responde 200
# ✅ /ready responde 200
# ✅ /health responde JSON válido
# ✅ /metrics expone Prometheus format
# ✅ db_errors_total metric existe
```

### Test manual de endpoints

```bash
# Login
curl -X POST https://hpn-vouchers-backend.fly.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hotel.com","password":"admin123"}'

# Health check
curl https://hpn-vouchers-backend.fly.dev/health

# Métricas
curl https://hpn-vouchers-backend.fly.dev/metrics | grep http_requests_total
```

---

## 🔄 Rollback

Si un deployment tiene problemas:

```bash
# Ver historial de releases
flyctl releases -a hpn-vouchers-backend

# Rollback a versión anterior
flyctl releases rollback v5 -a hpn-vouchers-backend
# Reemplazar v5 con la versión deseada
```

---

## ⚙️ Configuración Avanzada

### Scaling

```bash
# Ver configuración actual
flyctl scale show -a hpn-vouchers-backend

# Escalar instancias
flyctl scale count 2 -a hpn-vouchers-backend

# Cambiar tamaño de VM
flyctl scale vm shared-cpu-1x --memory 512 -a hpn-vouchers-backend
```

### Secrets management

```bash
# Listar secrets
flyctl secrets list -a hpn-vouchers-backend

# Agregar secret
flyctl secrets set NEW_SECRET="value" -a hpn-vouchers-backend

# Eliminar secret
flyctl secrets unset OLD_SECRET -a hpn-vouchers-backend

# Importar desde archivo
flyctl secrets import -a hpn-vouchers-backend < secrets.txt
```

### Base de datos

El backend usa **SQLite** persistente:

```bash
# SSH a la instancia
flyctl ssh console -a hpn-vouchers-backend

# Dentro del contenedor:
ls -lh /app/db/vouchers.db
sqlite3 /app/db/vouchers.db ".tables"
```

**⚠️ Backup importante**:
```bash
# Desde SSH
sqlite3 /app/db/vouchers.db ".backup /tmp/backup.db"
# Luego descargar con sftp o similar
```

---

## 🛠️ Troubleshooting

### Error: Health checks failing

**Causa**: DB no accesible o proceso crashed.

**Solución**:
```bash
# 1. Ver logs
flyctl logs -a hpn-vouchers-backend

# 2. Verificar estado
flyctl status -a hpn-vouchers-backend

# 3. Restart
flyctl apps restart hpn-vouchers-backend
```

### Error: Out of memory

**Causa**: VM muy pequeña o memory leak.

**Solución**:
```bash
# Ver uso de memoria
flyctl status -a hpn-vouchers-backend

# Escalar memoria
flyctl scale vm shared-cpu-1x --memory 512 -a hpn-vouchers-backend
```

### Error: CORS blocked

**Causa**: Frontend no incluido en `CORS_ORIGIN`.

**Solución**:
```bash
# Actualizar CORS
flyctl secrets set CORS_ORIGIN="...,https://nuevo-dominio.com" -a hpn-vouchers-backend

# Restart
flyctl apps restart hpn-vouchers-backend
```

### Error: 502 Bad Gateway

**Causa**: App no responde en el puerto correcto.

**Solución**:
```bash
# Verificar PORT en fly.toml
grep "internal_port" fly.toml  # Debe ser 3001

# Verificar que la app escucha en ese puerto
flyctl logs -a hpn-vouchers-backend | grep "listening"
```

---

## 📝 Checklist Pre-Deploy

Antes de cada deploy, verificar:

- [ ] Tests pasan localmente (`npm test`)
- [ ] Build exitoso (`npm run build` si aplica)
- [ ] `.env.example` actualizado con nuevas variables
- [ ] Secrets configurados en Fly.io
- [ ] CORS incluye todos los dominios necesarios
- [ ] Migrations ejecutadas (si aplican)
- [ ] Backup de DB (si es cambio crítico)

---

## 🎯 Post-Deploy Checklist

Después de deployar:

- [ ] Health checks pasan (`/live`, `/ready`, `/health`)
- [ ] Métricas expuestas (`/metrics`)
- [ ] No hay errores en logs
- [ ] Endpoints principales responden correctamente
- [ ] CORS funciona desde frontend
- [ ] Tests E2E pasan (si existen)
- [ ] Monitoreo activo

---

## 📞 Comandos Útiles

```bash
# Info general
flyctl info -a hpn-vouchers-backend

# SSH
flyctl ssh console -a hpn-vouchers-backend

# Config actual
flyctl config show -a hpn-vouchers-backend

# Restart
flyctl apps restart hpn-vouchers-backend

# Logs en vivo con filtro
flyctl logs -a hpn-vouchers-backend | grep -E "(ERROR|WARN)"

# Abrir en browser
flyctl open -a hpn-vouchers-backend
```

---

## 📚 Referencias

- [Fly.io Docs](https://fly.io/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Prometheus Metrics](https://prometheus.io/docs/concepts/metric_types/)
- [Frontend Deployment](../frontend/DEPLOYMENT.md)

---

**Última actualización**: 2025-10-30  
**Versión**: 3.0.0  
**Status**: ✅ En Producción
