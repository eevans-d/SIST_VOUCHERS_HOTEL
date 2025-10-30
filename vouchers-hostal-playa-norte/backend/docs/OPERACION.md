# Runbook de Operación - Sistema Vouchers Hotel

## Índice
1. [Arranque y parada](#arranque-y-parada)
2. [Logs y monitoreo](#logs-y-monitoreo)
3. [Backups y restore](#backups-y-restore)
4. [Mantenimiento de base de datos](#mantenimiento-de-base-de-datos)
5. [Troubleshooting](#troubleshooting)
6. [Checklist de deploy](#checklist-de-deploy)

---

## Arranque y parada

### Arranque en Fly.io

```bash
# Listar máquinas
flyctl machines list -a hpn-vouchers-backend

# Arrancar máquina (si está detenida)
flyctl machines start <MACHINE_ID> -a hpn-vouchers-backend

# Ver estado del servicio
flyctl status -a hpn-vouchers-backend

# Ver logs en vivo
flyctl logs -a hpn-vouchers-backend

# Ver últimos logs sin seguir
flyctl logs -a hpn-vouchers-backend --no-tail | tail -200
```

### Parada controlada

```bash
# Stop (graceful)
flyctl machines stop <MACHINE_ID> -a hpn-vouchers-backend

# Forzar stop (si no responde en 5s)
flyctl machines stop <MACHINE_ID> -a hpn-vouchers-backend --force
```

---

## Logs y monitoreo

### Estructura de logs
- **Formato**: JSON con timestamp, service, nivel (info/error), mensaje.
- **Ubicación en contenedor**: `/app/logs/` (vinculado a volumen /data/logs).
- **Niveles**: info, warn, error (configurable con `LOG_LEVEL` env var).

### Lectura de logs

```bash
# Últimas 100 líneas
flyctl logs -a hpn-vouchers-backend --no-tail 2>&1 | head -100

# Filtrar por error
flyctl logs -a hpn-vouchers-backend --no-tail 2>&1 | grep -i error

# Seguimiento en vivo
flyctl logs -a hpn-vouchers-backend

# Descargar logs locales (en /data/logs del volumen)
# Nota: Requiere SSH o acceso directo al volumen
```

### Healthcheck

```bash
# Verificar que /health responde 200 OK
curl https://hpn-vouchers-backend.fly.dev/health

# Respuesta esperada:
# {"status":"ok","timestamp":"...","environment":"production","database":"connected"}
```

### Monitoreo recomendado

- **Intervalo**: healthcheck cada 15s (configurado en fly.toml).
- **Alertas sugeridas**:
  - Múltiples fallos de healthcheck → incidencia crítica.
  - Tasa de errores 5xx > 5% → investigar.
  - Latencia p95 > 2s → revisar índices/cache.

### Métricas Prometheus

- Endpoint: `GET /metrics` (formato de texto de Prometheus)
- Métricas expuestas:
  - `http_requests_total{method,route,status_code}`
  - `http_request_duration_seconds_bucket` (histograma)
  - `http_server_errors_total{route,status_code}`
  - Métricas del proceso Node.js (GC, heap, event loop)

```bash
# Ver métricas rápidamente
curl -s https://hpn-vouchers-backend.fly.dev/metrics | head -50

# Filtrar por errores 5xx
curl -s https://hpn-vouchers-backend.fly.dev/metrics | grep http_server_errors_total
```

---

## Backups y restore

### Backup manual del volumen /data

```bash
# Listar volúmenes
flyctl volumes list -a hpn-vouchers-backend

# Ver detalles del volumen (ID, tamaño, etc.)
flyctl volumes show <VOLUME_ID> -a hpn-vouchers-backend

# Backup (SSH a la máquina y copiar desde /data)
flyctl ssh console -a hpn-vouchers-backend
# Dentro del contenedor:
# tar czf /tmp/data-backup-$(date +%Y%m%d-%H%M%S).tar.gz /data/
# exit

# Descarga local (recomendado: usar S3 o similiar para automatizar)
# Ejemplo con rclone o rsync vía SSH Fly
```

### Backup automatizado (recomendación)

Crear un job cron en Fly.io que:
1. Conecte al volumen /data.
2. Ejecute VACUUM y ANALYZE en la DB.
3. Comprima y suba a S3 o Google Cloud Storage.
4. Guarde daily snapshots por 30 días.

**Ejemplo básico (script para ejecutar periódicamente)**:
```bash
#!/bin/bash
# backup.sh
set -e
DB_PATH="/data/vouchers.db"
BACKUP_DIR="/data/backups"
mkdir -p "$BACKUP_DIR"

# Vacuum y analyze
sqlite3 "$DB_PATH" "VACUUM; ANALYZE;"

# Tar del volumen completo
BACKUP_FILE="$BACKUP_DIR/data-$(date +%Y%m%d-%H%M%S).tar.gz"
tar czf "$BACKUP_FILE" /data/ --exclude="$BACKUP_DIR"

# Opcional: borrar backups antiguos (>30 días)
find "$BACKUP_DIR" -name "data-*.tar.gz" -mtime +30 -delete

echo "Backup completado: $BACKUP_FILE"
```

### Restore desde backup

```bash
# 1. Detener la aplicación
flyctl machines stop <MACHINE_ID> -a hpn-vouchers-backend

# 2. SSH a la máquina
flyctl ssh console -a hpn-vouchers-backend

# 3. Descompimir backup (asumiendo que subiste el archivo)
cd /
tar xzf /path/to/data-YYYYMMDD-HHMMSS.tar.gz

# 4. Verificar integridad (SQLite)
sqlite3 /data/vouchers.db "PRAGMA integrity_check;"

# 5. Arrancar nuevamente
exit  # Salir del SSH
flyctl machines start <MACHINE_ID> -a hpn-vouchers-backend

# 6. Verificar healthcheck
curl https://hpn-vouchers-backend.fly.dev/health
```

---

## Mantenimiento de base de datos

### VACUUM (libera espacio y optimiza)

```bash
# Vía SSH
flyctl ssh console -a hpn-vouchers-backend
sqlite3 /data/vouchers.db "VACUUM;"
exit
```

### ANALYZE (recolecta estadísticas para query planner)

```bash
# Vía SSH
flyctl ssh console -a hpn-vouchers-backend
sqlite3 /data/vouchers.db "ANALYZE;"
exit
```

### Índices recomendados (si no existen)

```sql
-- Crear en src/scripts/migrate.js o ejecutar manualmente
CREATE INDEX IF NOT EXISTS idx_voucher_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_voucher_hotelCode ON vouchers(hotelCode);
CREATE INDEX IF NOT EXISTS idx_voucher_createdAt ON vouchers(createdAt);
CREATE INDEX IF NOT EXISTS idx_stay_hotelCode ON stays(hotelCode);
CREATE INDEX IF NOT EXISTS idx_stay_checkIn ON stays(checkInDate);
CREATE INDEX IF NOT EXISTS idx_stay_checkOut ON stays(checkOutDate);
```

### Tamaño de la base de datos

```bash
# Vía SSH
flyctl ssh console -a hpn-vouchers-backend
ls -lh /data/vouchers.db
sqlite3 /data/vouchers.db "SELECT page_count * page_size as size_bytes FROM pragma_page_count(), pragma_page_size();"
exit
```

---

## Troubleshooting

### La app arranca pero healthcheck falla

**Síntoma**: Logs muestran `✅ Base de datos conectada` pero Fly reporta healthcheck fallido.

**Causa común**: El servidor no escucha en `0.0.0.0:3000` o hay latencia en responder.

**Solución**:
1. Verificar que `app.listen(PORT, '0.0.0.0')` esté en src/index.js.
2. Aumentar `grace_period` en fly.toml si el startup es lento.
3. Revisar logs de error y confirmar que la DB se conectó.

### La app se cuelga o no responde

**Síntoma**: Healthcheck pasa inicialmente pero luego fallos intermitentes.

**Causa común**: Consulta SQL bloqueante, leak de memoria, o falta de recursos.

**Solución**:
1. Revisar logs para errores de query.
2. Ejecutar VACUUM + ANALYZE.
3. Aumentar memoria en fly.toml si es necesario (actualmente 512MB).
4. Revisar índices en tablas frecuentes.

### Error: "Could not locate the bindings file better_sqlite3.node"

**Síntoma**: App falla al iniciar con error de native module.

**Causa**: Dockerfile no compila better-sqlite3 correctamente.

**Solución** (ya aplicada):
- Usar Debian slim, no Alpine.
- Ejecutar `npm ci` con `npm_config_build_from_source=better-sqlite3`.
- Verificar que la imagen tenga toolchain (gcc, g++, make).

### Logs no aparecen en production

**Síntoma**: No hay salida de logs en `flyctl logs`.

**Causa**: `LOG_TO_CONSOLE` no está habilitado.

**Solución**:
1. Actualizar env en fly.toml: `LOG_TO_CONSOLE = "true"`.
2. Redeploy.
3. Verificar que Winston esté configurado con transporte a consola.

### Base de datos corrupta

**Síntoma**: Errores de "database disk image is malformed".

**Solución**:
1. Parar la app.
2. SSH a la máquina y ejecutar: `sqlite3 /data/vouchers.db "PRAGMA integrity_check;"`
3. Si reporta errores, restaurar desde backup (ver sección Backup & Restore).
4. Si no hay backup, considerar un rebuild de DB desde dump SQL (si se exportó previamente).

---

## Checklist de deploy

### Antes de desplegar

- [ ] Tests locales pasando (npm test).
- [ ] Build local OK sin errores.
- [ ] Secrets revisados en fly.toml y .env (JWT_SECRET, REDIS_URL, etc.).
- [ ] Logs configurados con nivel apropiado.
- [ ] CORS y CSP revisados para orígenes esperados.

### Deploy

```bash
cd backend
git add -A
git commit -m "chore: versión para producción X.Y.Z"
git push

# Build y deploy en Fly
flyctl deploy --remote-only --no-cache -a hpn-vouchers-backend

# Seguir logs
flyctl logs -a hpn-vouchers-backend
```

### Después del deploy

- [ ] Healthcheck pasa (curl /health).
- [ ] Logs muestran startup sin errores.
- [ ] Base de datos conectada y accesible.
- [ ] Rutas críticas probadas (login, crear voucher, etc.).
- [ ] Performance dentro de norma (p95 latencia < 2s).

### Rollback rápido

```bash
# Si algo falla, volver a la imagen anterior
flyctl releases -a hpn-vouchers-backend  # Ver historial
flyctl releases rollback -a hpn-vouchers-backend  # Rollback automático
```

---

## Escalabilidad futura

- **DB**: Si el volumen crece o necesitas múltiples escritores, migrar a Postgres.
- **Cache**: Ampliar Redis a un cluster dedicado.
- **Infra**: Pasar a múltiples máquinas con load balancer (Fly permite esto).
- **Métrica**: Implementar /metrics con Prometheus para alertas avanzadas.

---

Última actualización: 2025-10-30
