# 📊 Scripts de Monitoreo y Validación

> Herramientas para monitorear y validar el backend en producción

---

## 📋 Scripts Disponibles

### 1. `monitor.sh` - Monitor en Tiempo Real (Terminal)

Monitor interactivo en la terminal que muestra métricas del backend cada 5 segundos.

**Uso**:
```bash
./scripts/monitor.sh
```

**Features**:
- ✅ Health status en tiempo real
- ✅ Liveness y Readiness probes
- ✅ Métricas Prometheus (HTTP, DB, Memory)
- ✅ Response times
- ✅ Auto-refresh cada 5s
- ✅ Colores y formato visual

**Variables de entorno**:
```bash
# URL del backend (default: https://hpn-vouchers-backend.fly.dev)
BACKEND_URL=https://mi-backend.fly.dev ./scripts/monitor.sh

# Intervalo de refresh en segundos (default: 5)
REFRESH_INTERVAL=10 ./scripts/monitor.sh
```

**Salir**: `Ctrl+C`

---

### 2. `monitor.html` - Dashboard Web

Dashboard HTML con interfaz gráfica para visualizar métricas en el navegador.

**Uso**:
```bash
# Abrir directamente
open scripts/monitor.html

# O servir con un servidor web simple
python3 -m http.server 8000 --directory scripts
# Luego abrir: http://localhost:8000/monitor.html
```

**Features**:
- 🎨 Interfaz visual moderna
- ✅ Health status y uptime
- ✅ Métricas de HTTP, DB y memoria
- ✅ Progress bars para memoria
- ✅ Auto-refresh cada 5s
- ✅ Responsive design

**Configuración**:

Editar la constante `BACKEND_URL` en el archivo si necesitas cambiarla:
```javascript
const BACKEND_URL = 'https://tu-backend.fly.dev';
```

---

### 3. `smoke-check.sh` - Validación Rápida

Script de validación rápida que verifica los endpoints críticos.

**Uso**:
```bash
./scripts/smoke-check.sh
```

**Tests**:
- ✅ `/live` - Liveness probe
- ✅ `/ready` - Readiness probe
- ✅ `/health` - Health check
- ✅ `/metrics` - Métricas Prometheus
- ✅ `db_errors_total` metric existe

**Exit codes**:
- `0` - Todos los tests pasaron
- `1` - Algún test falló

---

### 4. `validate-deploy.sh` - Validación Post-Deploy

Validación completa después de un deployment.

**Uso**:
```bash
./scripts/validate-deploy.sh
```

**Tests**:
- ✅ Todos los de smoke-check
- ✅ Parsing de JSON responses
- ✅ Verificación de status codes
- ✅ Validación de estructura de datos

---

## 🎯 Casos de Uso

### Desarrollo

Monitorear el backend mientras desarrollas:
```bash
# Terminal 1: Servidor
npm run dev

# Terminal 2: Monitor
BACKEND_URL=http://localhost:3001 ./scripts/monitor.sh
```

### Pre-Deploy

Validar que todo esté OK antes de deployar:
```bash
npm test
./scripts/smoke-check.sh
```

### Post-Deploy

Validar que el deployment fue exitoso:
```bash
flyctl deploy -a hpn-vouchers-backend
./scripts/validate-deploy.sh
```

### Debugging

Monitorear en tiempo real cuando hay problemas:
```bash
# Terminal 1: Logs
flyctl logs -a hpn-vouchers-backend

# Terminal 2: Monitor
./scripts/monitor.sh

# Terminal 3: Métricas específicas
watch -n 5 'curl -s https://hpn-vouchers-backend.fly.dev/metrics | grep http_server_errors_total'
```

### Monitoreo Continuo

Dashboard visual para dejar abierto:
```bash
# Abrir dashboard
open scripts/monitor.html

# O en servidor
python3 -m http.server 8000 --directory scripts &
open http://localhost:8000/monitor.html
```

---

## 📊 Métricas Disponibles

### Health Endpoints

| Endpoint | Respuesta | Uso |
|----------|-----------|-----|
| `/live` | `{"status":"live"}` | Liveness probe (Fly.io) |
| `/ready` | `{"status":"ready"}` | Readiness probe (balanceador) |
| `/health` | JSON detallado | Health check completo |

### Prometheus Metrics

```promql
# HTTP
http_requests_total{method,route,status_code}
http_request_duration_seconds{method,route,status_code}
http_server_errors_total{route,status_code}

# Database
db_errors_total{operation,error_code}

# Node.js
nodejs_heap_size_used_bytes
nodejs_heap_size_total_bytes
nodejs_gc_duration_seconds
process_cpu_user_seconds_total
process_uptime_seconds
```

Ver documentación completa: [`../docs/OBSERVABILITY.md`](../docs/OBSERVABILITY.md)

---

## 🔧 Troubleshooting

### Script no ejecutable

```bash
chmod +x scripts/*.sh
```

### Error: "command not found: jq"

Instalar `jq`:
```bash
# Ubuntu/Debian
sudo apt install jq

# macOS
brew install jq
```

### Error: "command not found: bc"

Instalar `bc`:
```bash
# Ubuntu/Debian
sudo apt install bc

# macOS (ya viene instalado)
```

### Backend no responde

```bash
# Ver estado
flyctl status -a hpn-vouchers-backend

# Ver logs
flyctl logs -a hpn-vouchers-backend

# Restart
flyctl apps restart hpn-vouchers-backend
```

### CORS error en monitor.html

El dashboard HTML hace requests directos al backend. Si ves errores de CORS en la consola, el backend debe permitir el origen:

```bash
# Opción 1: Permitir todos los orígenes (solo dev)
flyctl secrets set CORS_ORIGIN="*" -a hpn-vouchers-backend

# Opción 2: Permitir origen específico
flyctl secrets set CORS_ORIGIN="http://localhost:8000" -a hpn-vouchers-backend
```

---

## 📝 Ejemplos de Output

### monitor.sh

```
╔═══════════════════════════════════════════════════════════╗
║      Backend Production Monitor - Hostal Playa Norte      ║
╚═══════════════════════════════════════════════════════════╝

Backend: https://hpn-vouchers-backend.fly.dev
Refresh: Every 5s (Press Ctrl+C to stop)

Last update: 2025-10-30 15:30:00

┌─ Health Status
│ Status:    ✓ ok
│ Version:   3.0.0
│ Uptime:    2h 15m 30s
│ Database:  ✓ connected
└─

┌─ Probes
│ Liveness:  ✓ OK (200)
│ Readiness: ✓ OK (200)
└─

┌─ Prometheus Metrics
│ HTTP Requests:      1250
│ HTTP 5xx Errors:    0
│ DB Errors:          0
│ Memory (heap):      45.2MB / 256.0MB (17.6%)
│ Process Uptime:     2h 15m 30s
└─

┌─ Response Times
│ /health:   45ms
│ /metrics:  120ms
└─
```

### smoke-check.sh

```
🔍 Running smoke tests...

✅ Test 1: /live endpoint
   ✓ HTTP 200 OK
   ✓ Response contains "status"

✅ Test 2: /ready endpoint
   ✓ HTTP 200 OK
   ✓ Response contains "status"

✅ Test 3: /health endpoint
   ✓ HTTP 200 OK
   ✓ JSON valid
   ✓ Status: ok

✅ Test 4: /metrics endpoint
   ✓ HTTP 200 OK
   ✓ Prometheus format

✅ Test 5: db_errors_total metric
   ✓ Metric exposed

════════════════════════════════════════
✅ All tests passed (5/5)
════════════════════════════════════════
```

---

## 🚀 Próximas Mejoras

- [ ] Alertas por email/Slack cuando métricas superan umbrales
- [ ] Histórico de métricas (persistir en JSON)
- [ ] Gráficos de tendencia (Chart.js)
- [ ] Comparación before/after deploy
- [ ] Export de métricas a CSV
- [ ] Integración con Prometheus/Grafana

---

## 📚 Referencias

- [Backend Deployment Guide](../DEPLOYMENT.md)
- [Observability Documentation](../docs/OBSERVABILITY.md)
- [Prometheus Metrics](https://prometheus.io/docs/concepts/metric_types/)
- [Fly.io Monitoring](https://fly.io/docs/reference/metrics/)

---

**Última actualización**: 2025-10-30  
**Versión**: 1.0.0
