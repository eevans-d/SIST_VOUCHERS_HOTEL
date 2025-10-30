# 📊 Guía de Observabilidad y Monitoreo

> Sistema completo de métricas, logs y health checks para producción

---

## 🎯 Overview

El backend expone múltiples capas de observabilidad:

1. **Health Checks** - Liveness, Readiness y Health detallado
2. **Métricas Prometheus** - HTTP, DB, proceso Node.js
3. **Logs estructurados** - Winston con niveles y rotación
4. **Audit trail** - Logs de auditoría de acciones críticas

---

## 🏥 Health Checks

### `/live` - Liveness Probe

**Propósito**: Verificar que el proceso está vivo (sin validación de dependencias).

```bash
curl https://hpn-vouchers-backend.fly.dev/api/live
```

**Respuesta**:
```json
{"status":"ok"}
```

**Códigos HTTP**:
- `200` - Proceso vivo
- `5xx` - Proceso crashed (Fly.io reiniciará)

**Cuándo usar**: Kubernetes/Fly.io liveness probe para restart automático.

---

### `/ready` - Readiness Probe

**Propósito**: Verificar que el servicio está listo para recibir tráfico.

```bash
curl https://hpn-vouchers-backend.fly.dev/api/ready
```

**Respuesta OK**:
```json
{"status":"ready"}
```

**Respuesta NOT READY**:
```json
{"status":"not_ready","error":"Database connection failed"}
```

**Códigos HTTP**:
- `200` - Listo para tráfico
- `503` - No listo (DB inaccesible, etc.)

**Checks realizados**:
- ✅ Conexión a base de datos
- ✅ Puede ejecutar queries básicos

**Cuándo usar**: Load balancer readiness check, durante deploys.

---

### `/health` - Health Detallado

**Propósito**: Información completa de salud del sistema.

```bash
curl https://hpn-vouchers-backend.fly.dev/api/health
```

**Respuesta**:
```json
{
  "status": "ok",
  "timestamp": "2025-10-30T15:30:00.000Z",
  "uptime": 12345,
  "environment": "production",
  "version": "3.0.0",
  "checks": {
    "database": {
      "status": "ok",
      "responseTime": 5
    },
    "memory": {
      "used": "45MB",
      "total": "256MB",
      "percentage": 17.5
    },
    "cpu": {
      "usage": 12.3
    }
  }
}
```

**Campos**:
- `status` - Estado global: `ok` | `degraded` | `error`
- `timestamp` - ISO 8601
- `uptime` - Segundos desde inicio
- `checks.database` - Conexión y latencia
- `checks.memory` - Uso de memoria del proceso
- `checks.cpu` - Uso de CPU (%)

**Códigos HTTP**:
- `200` - Sistema saludable
- `503` - Sistema degradado/error

**Cuándo usar**: Dashboards, monitoreo, debugging.

---

## 📈 Métricas Prometheus

### Endpoint `/metrics`

```bash
curl https://hpn-vouchers-backend.fly.dev/api/metrics
```

**Formato**: Prometheus text exposition format.

---

### Métricas HTTP

#### `http_requests_total`

**Tipo**: Counter  
**Descripción**: Total de requests HTTP recibidos.

**Labels**:
- `method` - GET, POST, PUT, DELETE, etc.
- `route` - Ruta de la request (ej: `/api/vouchers`)
- `status_code` - 200, 404, 500, etc.

**Query ejemplo**:
```promql
# Rate de requests por segundo
rate(http_requests_total[5m])

# Requests por ruta
sum by (route) (http_requests_total)

# Tasa de errores 4xx
rate(http_requests_total{status_code=~"4.."}[5m])
```

---

#### `http_request_duration_seconds`

**Tipo**: Histogram  
**Descripción**: Duración de requests HTTP.

**Labels**:
- `method`, `route`, `status_code`

**Buckets**: 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5 segundos

**Query ejemplo**:
```promql
# Latencia p50, p95, p99
histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Latencia promedio
rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])

# Requests lentas (>1s)
sum(http_request_duration_seconds_bucket{le="1"}) by (route)
```

---

#### `http_server_errors_total`

**Tipo**: Counter  
**Descripción**: Total de errores 5xx del servidor.

**Labels**:
- `route` - Ruta que generó el error
- `status_code` - 500, 502, 503, etc.

**Query ejemplo**:
```promql
# Rate de errores 5xx
rate(http_server_errors_total[5m])

# Errores por ruta
sum by (route) (http_server_errors_total)

# Alerta si tasa > 1 error/min
rate(http_server_errors_total[1m]) > 1/60
```

---

### Métricas de Base de Datos

#### `db_errors_total`

**Tipo**: Counter  
**Descripción**: Total de errores en operaciones de base de datos.

**Labels**:
- `operation` - connect, query, insert, update, delete, transaction, health_check
- `error_code` - SQLITE_CONSTRAINT, SQLITE_BUSY, etc.

**Query ejemplo**:
```promql
# Rate de errores de DB
rate(db_errors_total[5m])

# Errores por operación
sum by (operation) (db_errors_total)

# Errores de constraint
db_errors_total{error_code="SQLITE_CONSTRAINT"}

# Alerta si hay errores de DB
increase(db_errors_total[5m]) > 0
```

**Instrumentación en código**:
```javascript
import { recordDbError } from './middleware/metrics.js';

try {
  // Operación de DB
} catch (error) {
  recordDbError('query', error.code || 'unknown');
  throw error;
}
```

---

### Métricas de Node.js (default)

El backend expone automáticamente métricas de Node.js:

#### Memoria

```promql
# Heap usado
nodejs_heap_size_used_bytes

# Heap total
nodejs_heap_size_total_bytes

# Memoria externa
nodejs_external_memory_bytes

# % uso de heap
(nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes) * 100
```

#### CPU

```promql
# CPU user time
rate(process_cpu_user_seconds_total[5m])

# CPU system time
rate(process_cpu_system_seconds_total[5m])

# CPU total
rate(process_cpu_user_seconds_total[5m]) + rate(process_cpu_system_seconds_total[5m])
```

#### Event Loop

```promql
# Event loop lag
nodejs_eventloop_lag_seconds

# Event loop lag p99
nodejs_eventloop_lag_p99_seconds
```

#### Garbage Collection

```promql
# GC duración
rate(nodejs_gc_duration_seconds_sum[5m])

# GC por tipo
sum by (kind) (nodejs_gc_duration_seconds_count)
```

---

## 📝 Logs

### Configuración

**Winston** con transports a archivo y consola.

**Niveles**:
- `error` - Errores críticos
- `warn` - Advertencias
- `info` - Información general
- `debug` - Debugging detallado

**Configuración vía env**:
```bash
LOG_LEVEL=info  # error|warn|info|debug
```

### Log Files

```
logs/
├── error.log       # Solo errores
├── combined.log    # Todos los niveles
└── audit.log       # Auditoría de acciones críticas
```

**Rotación**: Automática con `winston-daily-rotate-file`.

### Formato de logs

**Desarrollo**:
```
2025-10-30 15:30:00 [info]: Server listening on port 3001
```

**Producción** (JSON):
```json
{
  "level": "info",
  "message": "Server listening on port 3001",
  "timestamp": "2025-10-30T15:30:00.000Z",
  "service": "voucher-system"
}
```

### Logs en producción (Fly.io)

```bash
# Ver logs en vivo
flyctl logs -a hpn-vouchers-backend

# Filtrar por nivel
flyctl logs -a hpn-vouchers-backend | grep ERROR
flyctl logs -a hpn-vouchers-backend | grep WARN

# Últimas 100 líneas
flyctl logs -a hpn-vouchers-backend --lines 100

# Desde timestamp
flyctl logs -a hpn-vouchers-backend --since 2025-10-30T15:00:00Z
```

### Audit Logs

**Eventos auditados**:
- Login exitoso/fallido
- Creación de vouchers
- Modificación de órdenes
- Cambios de configuración

**Formato**:
```json
{
  "level": "audit",
  "action": "voucher.created",
  "userId": "user123",
  "orderId": "order456",
  "timestamp": "2025-10-30T15:30:00.000Z",
  "ip": "192.168.1.1"
}
```

---

## 🔔 Alertas Recomendadas

### Errores HTTP (5xx)

```promql
# Alerta si > 5% de requests son 5xx
(
  rate(http_server_errors_total[5m])
  /
  rate(http_requests_total[5m])
) > 0.05
```

### Latencia alta

```promql
# Alerta si p95 > 1 segundo
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
```

### Errores de base de datos

```promql
# Alerta si hay cualquier error de DB en 5 minutos
increase(db_errors_total[5m]) > 0
```

### Memoria alta

```promql
# Alerta si uso de heap > 80%
(nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes) > 0.8
```

### Health check fallando

```bash
# Monitorear /ready endpoint
# Alerta si 3 fallos consecutivos en 1 minuto
```

### CPU alta

```promql
# Alerta si CPU > 80% por 5 minutos
rate(process_cpu_user_seconds_total[5m]) > 0.8
```

---

## 📊 Dashboards Recomendados

### Dashboard "Overview"

**Paneles**:
1. Request rate (RPS)
2. Latency p50, p95, p99
3. Error rate (%)
4. Active instances
5. CPU usage
6. Memory usage

**Queries**:
```promql
# RPS
sum(rate(http_requests_total[5m]))

# Error rate
sum(rate(http_server_errors_total[5m])) / sum(rate(http_requests_total[5m]))

# Latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### Dashboard "Database"

**Paneles**:
1. DB error rate
2. Errors por operación
3. Errors por código
4. Query latency (si instrumentada)

**Queries**:
```promql
# Error rate
rate(db_errors_total[5m])

# Por operación
sum by (operation) (rate(db_errors_total[5m]))

# Por código
sum by (error_code) (db_errors_total)
```

### Dashboard "Node.js"

**Paneles**:
1. Heap used/total
2. GC duration
3. Event loop lag
4. Open file descriptors

**Queries**:
```promql
# Heap %
(nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes) * 100

# GC rate
rate(nodejs_gc_duration_seconds_count[5m])

# Event loop lag
nodejs_eventloop_lag_p99_seconds
```

---

## 🔧 Instrumentación Custom

### Agregar nueva métrica

```javascript
// En metrics.js
import client from 'prom-client';

// Crear métrica
const myCustomCounter = new client.Counter({
  name: 'my_custom_events_total',
  help: 'Total de eventos custom',
  labelNames: ['type', 'status'],
});
register.registerMetric(myCustomCounter);

// Exportar
export { myCustomCounter };

// Usar en código
import { myCustomCounter } from './middleware/metrics.js';

myCustomCounter.inc({ type: 'voucher_generated', status: 'success' });
```

### Tipos de métricas disponibles

**Counter**: Solo incrementa (requests, errores, eventos).
```javascript
const counter = new client.Counter({
  name: 'events_total',
  help: 'Total events',
  labelNames: ['type'],
});
counter.inc({ type: 'login' });
```

**Gauge**: Puede subir y bajar (memoria, connections).
```javascript
const gauge = new client.Gauge({
  name: 'active_connections',
  help: 'Active connections',
});
gauge.set(42);
gauge.inc();
gauge.dec();
```

**Histogram**: Distribución (latencias, tamaños).
```javascript
const histogram = new client.Histogram({
  name: 'request_size_bytes',
  help: 'Request size in bytes',
  buckets: [100, 500, 1000, 5000],
});
histogram.observe(1234);
```

**Summary**: Similar a histogram pero con quantiles calculados en el cliente.
```javascript
const summary = new client.Summary({
  name: 'request_duration_seconds',
  help: 'Request duration',
  percentiles: [0.5, 0.9, 0.99],
});
summary.observe(0.123);
```

---

## 🎯 Best Practices

### Labels

✅ **Buenos labels**:
- Cardinalidad baja (<100 valores únicos)
- `method`, `status_code`, `route`, `operation`, `error_code`

❌ **Malos labels**:
- Cardinalidad alta (IDs de usuario, tokens, timestamps)
- `user_id`, `order_id`, `session_id`

### Naming

**Convención**: `{namespace}_{subsystem}_{name}_{unit}`

Ejemplos:
- `http_requests_total` (counter)
- `http_request_duration_seconds` (histogram)
- `db_connections_active` (gauge)
- `vouchers_generated_total` (counter)

### Instrumentación

- ✅ Instrumentar en capas altas (middleware, servicios)
- ✅ Catch errores y registrar en métricas
- ✅ Usar helpers (`recordDbError`) para consistencia
- ❌ No instrumentar en cada función pequeña
- ❌ No crear métricas con alta cardinalidad

---

## 📚 Referencias

- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Node.js Monitoring Guide](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Winston Documentation](https://github.com/winstonjs/winston)
- [Fly.io Metrics](https://fly.io/docs/reference/metrics/)

---

**Última actualización**: 2025-10-30  
**Versión**: 1.0.0
