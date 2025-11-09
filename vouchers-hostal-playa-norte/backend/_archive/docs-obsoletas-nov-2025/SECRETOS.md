# Gestión de Secretos y Configuración - Producción

## Checklist de secretos requeridos

### Core (CRÍTICO - P0)

- [ ] **JWT_SECRET**: Clave para firmar JWTs (login/auth)
  - Mín. 32 caracteres, único por entorno
  - Ubicación en Fly: `flyctl secrets set JWT_SECRET="..."`
  - Ej: `$(openssl rand -base64 32)`

- [ ] **JWT_REFRESH_SECRET**: Clave para refresh tokens
  - Mín. 32 caracteres, diferente a JWT_SECRET
  - Ubicación en Fly: `flyctl secrets set JWT_REFRESH_SECRET="..."`

- [ ] **DATABASE_PATH**: Ruta a la base de datos SQLite
  - En Fly: `/data/vouchers.db` (volumen persistente)
  - En local: `./db/vouchers.db`
  - Ubicación: Dockerfile ENV (no secrets, es pública)

- [ ] **VOUCHER_SECRET**: Clave para encriptar/desencriptar vouchers
  - Mín. 32 caracteres
  - Ubicación en Fly: `flyctl secrets set VOUCHER_SECRET="..."`
  - Ej: `$(openssl rand -base64 32)`

### Seguridad (IMPORTANTE - P1)

- [ ] **NODE_ENV**: `production` (in Fly)
  - Ubicación: `fly.toml` → `[env]` section
  - Valor: `NODE_ENV = "production"`

- [ ] **LOG_LEVEL**: Nivel de logging (info, warn, error)
  - Ubicación: `fly.toml` → `[env]`
  - Recomendado: `LOG_LEVEL = "info"` (producción)
  - En dev: `LOG_LEVEL = "debug"`

- [ ] **LOG_TO_CONSOLE**: Habilitar logs en consola
  - Ubicación: `fly.toml` → `[env]`
  - Producción: `LOG_TO_CONSOLE = "true"` (importante para Fly.io)
  - Permite `flyctl logs` funcionar correctamente

- [ ] **BCRYPT_ROUNDS**: Complejidad hash de contraseñas
  - Ubicación: `fly.toml` → `[env]`
  - Recomendado: `BCRYPT_ROUNDS = "12"` (producción)
  - Mín. 10, máx. 15 (por rendimiento)

### Integración (OPCIONAL - P2)

- [ ] **REDIS_URL**: URL de redis para cache
  - Ubicación en Fly: `flyctl secrets set REDIS_URL="..."`
  - Formato: `redis://user:pass@host:port/db`
  - Si no se especifica: cache deshabilitado

- [ ] **CACHE_ENABLED**: Habilitar caché con Redis
  - Ubicación: `fly.toml` → `[env]`
  - Valor: `true` o `false`
  - Requiere REDIS_URL si está habilitado

- [ ] **API_KEY_PAYMENTS**: Clave para integraciones de pago
  - Ubicación en Fly: `flyctl secrets set API_KEY_PAYMENTS="..."`
  - Requerida: Solo si hay procesamiento de pagos

---

## Cómo cargar secretos en Fly.io

### Opción 1: Línea por línea

```bash
# JWT secrets
flyctl secrets set JWT_SECRET="$(openssl rand -base64 32)" -a hpn-vouchers-backend
flyctl secrets set JWT_REFRESH_SECRET="$(openssl rand -base64 32)" -a hpn-vouchers-backend

# Voucher secret
flyctl secrets set VOUCHER_SECRET="$(openssl rand -base64 32)" -a hpn-vouchers-backend

# Optional: Redis
# flyctl secrets set REDIS_URL="redis://..." -a hpn-vouchers-backend
```

### Opción 2: Archivo de secretos (recomendado para backup)

1. Crear archivo `.secrets.env` (NO subir a git):
```bash
cat > .secrets.env << 'EOF'
JWT_SECRET=your-jwt-secret-here-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-here-min-32-chars
VOUCHER_SECRET=your-voucher-secret-here-min-32-chars
REDIS_URL=redis://optional
EOF
```

2. Cargar en Fly.io:
```bash
# Linux/Mac
set -a
source .secrets.env
set +a
for line in $(cat .secrets.env); do
  flyctl secrets set "$line" -a hpn-vouchers-backend
done

# O manualmente:
flyctl secrets set JWT_SECRET="$(grep JWT_SECRET .secrets.env | cut -d= -f2)" -a hpn-vouchers-backend
```

### Verificar secretos cargados

```bash
# Listar secretos en Fly (no muestra valores)
flyctl secrets list -a hpn-vouchers-backend

# Ejemplo de output:
# NAME                    DIGEST                  CREATED AT
# JWT_SECRET              sha256:abc123...        2025-01-15T10:00:00Z
# JWT_REFRESH_SECRET      sha256:def456...        2025-01-15T10:00:00Z
# VOUCHER_SECRET          sha256:ghi789...        2025-01-15T10:00:00Z
```

---

## Configuración en fly.toml

```toml
[env]
# Core
NODE_ENV = "production"

# Logging
LOG_LEVEL = "info"
LOG_TO_CONSOLE = "true"

# Seguridad
BCRYPT_ROUNDS = "12"

# Cache (opcional)
CACHE_ENABLED = "false"

# Base de datos
DATABASE_PATH = "/data/vouchers.db"

# CORS (si aplica)
# CORS_ORIGIN = "https://admin.tudominio.com,https://hpn-vouchers-backend.fly.dev"
```

### Cómo actualizar env en Fly

```bash
# Editar fly.toml localmente, luego:
git add fly.toml
git commit -m "chore: update fly.toml env vars"
git push

# Deploy
flyctl deploy --remote-only -a hpn-vouchers-backend

# O setear variable directamente:
flyctl config set env NODE_ENV=production -a hpn-vouchers-backend
```

---

## Rotación de secretos

### Por qué rotar

- Compromiso de seguridad detectado.
- Cambio de personal/equipo.
- Auditoría de seguridad.
- Cada 90 días (policy recomendada).

### Procedimiento de rotación

1. **Generar nuevo secreto**:
```bash
NEW_JWT_SECRET="$(openssl rand -base64 32)"
echo "Nuevo JWT_SECRET: $NEW_JWT_SECRET"
```

2. **Cargar en Fly** (reemplaza el anterior):
```bash
flyctl secrets set JWT_SECRET="$NEW_JWT_SECRET" -a hpn-vouchers-backend
```

3. **Redeploy** para aplicar:
```bash
flyctl deploy --remote-only -a hpn-vouchers-backend
```

4. **Verificar en logs**:
```bash
flyctl logs -a hpn-vouchers-backend | grep "JWT\|Iniciando"
```

5. **Revocar acceso antiguo** (si aplica):
   - Si hay integración externa con API key, cambiar API key e informar usuarios.

---

## Auditoría y validación

### Pre-deploy checklist

```bash
#!/bin/bash
# scripts/pre-deploy-security-check.sh
set -e

echo "🔍 Pre-deploy Security Audit..."

# Verificar que no haya secretos en archivos
if grep -r "JWT_SECRET\|VOUCHER_SECRET" src/ --include="*.js" | grep -v 'process.env'; then
  echo "❌ ERROR: Secretos hardcoded encontrados!"
  exit 1
fi

# Verificar que NODE_ENV está set
if [ -z "$NODE_ENV" ]; then
  echo "❌ ERROR: NODE_ENV no está configurado"
  exit 1
fi

# Verificar que fly.toml existe
if [ ! -f "fly.toml" ]; then
  echo "❌ ERROR: fly.toml no encontrado"
  exit 1
fi

echo "✅ Pre-deploy audit OK"
```

### En producción

```bash
# Conectar a la máquina y revisar env vars
flyctl ssh console -a hpn-vouchers-backend
env | grep -i secret  # No debería mostrar valores reales
env | grep NODE_ENV   # Debería ser "production"
exit
```

---

## Recuperación ante pérdida de secreto

### Si se compromete JWT_SECRET

1. **Inmediato**: Generar nuevo JWT_SECRET y actualizar en Fly.
2. **Consequence**: Todos los tokens JWT activos quedan inválidos.
3. **Mitigación**: Los usuarios necesitarán re-loguear.

### Si se compromete VOUCHER_SECRET

1. **Inmediato**: Generar nuevo VOUCHER_SECRET.
2. **Consequence**: Vouchers encriptados con antiguo secret no se pueden desencriptar.
3. **Mitigación**: Re-encriptar vouchers activos con el nuevo secret (operación manual o script).

### Backup de secretos (seguro)

```bash
# Guardar localmente (muy seguro, sin subirlo a git)
flyctl secrets list -a hpn-vouchers-backend > /tmp/secrets-backup.txt
# Guardar en pass manager o vault seguro
# Nunca subir a git o repo público
```

---

## Documentación

- **Última actualización**: 2025-01-15
- **Responsable**: DevOps / Security Team
- **Auditoría próxima**: 2025-04-15 (90 días)
- **Referencias**: [Fly.io Secrets Docs](https://fly.io/docs/reference/secrets/)
