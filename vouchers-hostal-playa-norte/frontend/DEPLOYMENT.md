# 🚀 Guía de Deployment - Frontend

> Instrucciones paso a paso para desplegar el frontend en Fly.io

---

## 📋 Pre-requisitos

### 1. Herramientas necesarias

```bash
# Node.js 18 o superior
node --version  # debe ser >= 18

# Flyctl CLI
curl -L https://fly.io/install.sh | sh

# Git
git --version
```

### 2. Credenciales

- [ ] Cuenta en Fly.io ([sign up](https://fly.io/app/sign-up))
- [ ] Token de acceso o login activo

```bash
# Autenticarse en Fly.io
flyctl auth login
```

### 3. Backend funcionando

Verificar que el backend esté operativo:

```bash
curl https://hpn-vouchers-backend.fly.dev/api/health
# Debe retornar: {"status":"ok"}
```

---

## 🎯 Deployment Steps

### Paso 1: Preparar el código

```bash
# Ir al directorio del frontend
cd /home/eevan/ProyectosIA/SIST_VOUCHERS_HOTEL/vouchers-hostal-playa-norte/frontend

# Asegurar que estás en la rama correcta
git status

# Verificar que los archivos de deployment existen
ls -la .env.production Dockerfile.production fly.toml scripts/deploy-frontend.sh
```

### Paso 2: Build local (validación)

```bash
# Instalar dependencias (si no lo has hecho)
npm install

# Build local para verificar
npm run build

# Debería crear carpeta dist/ sin errores
ls -lh dist/
```

### Paso 3: Deploy a Fly.io

#### Primera vez (crear app)

```bash
# Lanzar app por primera vez
flyctl launch \
  --name hpn-vouchers-frontend \
  --region gru \
  --no-deploy

# IMPORTANTE: Decir "No" cuando pregunte:
# - "Would you like to set up a PostgreSQL database?" → NO
# - "Would you like to deploy now?" → NO

# Configurar variables de entorno
flyctl secrets set \
  VITE_API_URL="https://hpn-vouchers-backend.fly.dev/api" \
  -a hpn-vouchers-frontend

# Ahora sí, hacer el primer deploy
flyctl deploy \
  --config fly.toml \
  --dockerfile Dockerfile.production \
  -a hpn-vouchers-frontend
```

#### Deploys subsecuentes

```bash
# Usar el script automatizado
./scripts/deploy-frontend.sh

# O manualmente:
flyctl deploy \
  --config fly.toml \
  --dockerfile Dockerfile.production \
  -a hpn-vouchers-frontend
```

### Paso 4: Verificar deployment

```bash
# Ver estado de la app
flyctl status -a hpn-vouchers-frontend

# Abrir en el navegador
flyctl open -a hpn-vouchers-frontend

# Ver logs en vivo
flyctl logs -a hpn-vouchers-frontend
```

### Paso 5: Configurar CORS en backend

**⚠️ CRÍTICO**: El backend debe aceptar requests del frontend.

```bash
# Obtener URL del frontend
FRONTEND_URL=$(flyctl info -a hpn-vouchers-frontend | grep "Hostname" | awk '{print $2}')
echo "Frontend URL: https://${FRONTEND_URL}"

# Actualizar CORS en backend
flyctl secrets set \
  CORS_ORIGIN="https://hpn-vouchers-backend.fly.dev,https://${FRONTEND_URL}" \
  -a hpn-vouchers-backend

# Reiniciar backend para aplicar cambios
flyctl apps restart hpn-vouchers-backend
```

### Paso 6: Validar CORS

```bash
# Test preflight request
curl -v \
  -H "Origin: https://hpn-vouchers-frontend.fly.dev" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS \
  https://hpn-vouchers-backend.fly.dev/api/auth/login

# Buscar en la respuesta:
# Access-Control-Allow-Origin: https://hpn-vouchers-frontend.fly.dev
# Access-Control-Allow-Methods: ...
```

---

## ✅ Post-Deployment Checklist

Después de deployar, verificar:

- [ ] Frontend carga correctamente (200 OK)
  ```bash
  curl -I https://hpn-vouchers-frontend.fly.dev
  ```

- [ ] Health check responde
  ```bash
  curl https://hpn-vouchers-frontend.fly.dev/health
  # O visitar en el browser
  ```

- [ ] Login funciona (test desde browser)
  - Abrir https://hpn-vouchers-frontend.fly.dev
  - Intentar login con credenciales válidas
  - Verificar que no haya errores de CORS en la consola

- [ ] Metrics del backend actualizados
  ```bash
  curl https://hpn-vouchers-backend.fly.dev/api/metrics | grep http_requests_total
  ```

- [ ] No hay errores en logs
  ```bash
  flyctl logs -a hpn-vouchers-frontend --lines 50
  ```

---

## 🔍 Troubleshooting

### Error: "Failed to fetch"

**Causa**: CORS no configurado o URL del backend incorrecta.

**Solución**:
```bash
# 1. Verificar variables de entorno
flyctl secrets list -a hpn-vouchers-frontend

# 2. Verificar CORS en backend
flyctl secrets list -a hpn-vouchers-backend | grep CORS_ORIGIN

# 3. Si falta, configurar:
flyctl secrets set CORS_ORIGIN="..." -a hpn-vouchers-backend
```

### Error: "Build failed"

**Causa**: Dependencias faltantes o error de sintaxis.

**Solución**:
```bash
# 1. Build local para ver el error real
npm run build

# 2. Si es problema de dependencias:
rm -rf node_modules package-lock.json
npm install
npm run build

# 3. Re-deploy
flyctl deploy -a hpn-vouchers-frontend
```

### Error: "Health checks failing"

**Causa**: Nginx no está sirviendo correctamente o puerto incorrecto.

**Solución**:
```bash
# 1. Ver logs
flyctl logs -a hpn-vouchers-frontend

# 2. Verificar que Dockerfile.production usa puerto 8080
grep "EXPOSE" Dockerfile.production

# 3. Verificar que fly.toml tiene internal_port = 8080
grep "internal_port" fly.toml

# 4. Re-deploy si hay discrepancia
```

### Error: "Cannot reach backend"

**Causa**: Backend inaccesible o URL incorrecta.

**Solución**:
```bash
# 1. Test directo al backend
curl https://hpn-vouchers-backend.fly.dev/api/health

# 2. Ver estado del backend
flyctl status -a hpn-vouchers-backend

# 3. Si está down, reiniciar
flyctl apps restart hpn-vouchers-backend
```

---

## 🔄 Rollback

Si el deployment introduce errores:

```bash
# Ver historial de releases
flyctl releases -a hpn-vouchers-frontend

# Rollback a versión anterior
flyctl releases rollback v2 -a hpn-vouchers-frontend
# Reemplazar v2 con la versión deseada
```

---

## 📊 Monitoreo

### Ver métricas en Fly.io

```bash
# Dashboard web
flyctl dashboard -a hpn-vouchers-frontend

# Métricas en terminal
flyctl status -a hpn-vouchers-frontend --watch
```

### Logs en vivo

```bash
# Todos los logs
flyctl logs -a hpn-vouchers-frontend

# Filtrar por tipo
flyctl logs -a hpn-vouchers-frontend | grep ERROR

# Últimas 100 líneas
flyctl logs -a hpn-vouchers-frontend --lines 100
```

---

## 🔧 Configuración Avanzada

### Scaling

```bash
# Ver configuración actual
flyctl scale show -a hpn-vouchers-frontend

# Cambiar cantidad de instancias
flyctl scale count 2 -a hpn-vouchers-frontend

# Cambiar tamaño de VM
flyctl scale vm shared-cpu-1x --memory 512 -a hpn-vouchers-frontend
```

### Secrets

```bash
# Listar secrets
flyctl secrets list -a hpn-vouchers-frontend

# Agregar nuevo secret
flyctl secrets set NEW_VAR="value" -a hpn-vouchers-frontend

# Eliminar secret
flyctl secrets unset OLD_VAR -a hpn-vouchers-frontend
```

### Dominio custom

```bash
# Agregar dominio
flyctl certs add vouchers.hostalplayanorte.com -a hpn-vouchers-frontend

# Verificar DNS
flyctl certs show vouchers.hostalplayanorte.com -a hpn-vouchers-frontend

# Listar certificados
flyctl certs list -a hpn-vouchers-frontend
```

---

## 🔐 Security Checklist

- [ ] HTTPS forzado (configurado en `fly.toml`)
- [ ] Secrets no commitadas en git
- [ ] CORS restrictivo (solo dominios conocidos)
- [ ] Headers de seguridad configurados en nginx
- [ ] No hay console.log con datos sensibles en producción

---

## 📞 Ayuda

### Comandos útiles

```bash
# Información general de la app
flyctl info -a hpn-vouchers-frontend

# SSH a la instancia
flyctl ssh console -a hpn-vouchers-frontend

# Ver configuración actual
flyctl config show -a hpn-vouchers-frontend

# Restart
flyctl apps restart hpn-vouchers-frontend
```

### Recursos

- [Fly.io Docs](https://fly.io/docs/)
- [Vite Deployment](https://vitejs.dev/guide/static-deploy.html)
- [Backend README](../backend/README.md)

---

## 🎯 Resumen del deployment exitoso

Si todo funciona correctamente, deberías poder:

1. ✅ Abrir https://hpn-vouchers-frontend.fly.dev
2. ✅ Ver la página de login sin errores 404/500
3. ✅ Login con credenciales válidas
4. ✅ Navegar por todas las secciones de la app
5. ✅ Ver datos cargados desde el backend
6. ✅ No hay errores en la consola del browser
7. ✅ No hay errores en logs de Fly.io

---

**Última actualización**: 2025-10-30  
**Versión**: 1.0.0
