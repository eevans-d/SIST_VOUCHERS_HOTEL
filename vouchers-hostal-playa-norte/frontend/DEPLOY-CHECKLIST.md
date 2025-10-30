# 🚀 Deployment Mañana - Checklist

## 📅 Fecha: [COMPLETAR MAÑANA]

---

## 🔐 Requisitos previos

### 1. Credenciales Fly.io

```bash
# Autenticarse
flyctl auth login

# Verificar login
flyctl auth whoami
```

**Status**: ⏳ Pendiente

---

## 🎯 Tareas de deployment

### ✅ Preparación (COMPLETADO HOY)

- [x] `.env.example` creado
- [x] `.env.production` configurado con URL backend
- [x] `Dockerfile.production` optimizado con nginx
- [x] `fly.toml` configurado
- [x] `deploy-frontend.sh` script creado
- [x] `smoke-test-frontend.sh` script creado
- [x] `README.md` documentación completa
- [x] `DEPLOYMENT.md` guía paso a paso
- [x] Cambios commiteados y pusheados

### ⏳ Deployment (MAÑANA)

#### Paso 1: Crear app en Fly.io

```bash
cd /home/eevan/ProyectosIA/SIST_VOUCHERS_HOTEL/vouchers-hostal-playa-norte/frontend

# Launch (primera vez)
flyctl launch \
  --name hpn-vouchers-frontend \
  --region gru \
  --no-deploy

# Responder "No" a:
# - PostgreSQL database → NO
# - Deploy now → NO
```

- [ ] App creada en Fly.io
- [ ] Nombre: `hpn-vouchers-frontend`
- [ ] Región: `gru` (São Paulo)

#### Paso 2: Configurar secrets

```bash
# Configurar variable de entorno
flyctl secrets set \
  VITE_API_URL="https://hpn-vouchers-backend.fly.dev/api" \
  -a hpn-vouchers-frontend

# Verificar
flyctl secrets list -a hpn-vouchers-frontend
```

- [ ] Secrets configurados
- [ ] `VITE_API_URL` apunta al backend correcto

#### Paso 3: Deploy

```bash
# Opción 1: Script automatizado (RECOMENDADO)
./scripts/deploy-frontend.sh

# Opción 2: Manual
flyctl deploy \
  --config fly.toml \
  --dockerfile Dockerfile.production \
  -a hpn-vouchers-frontend
```

- [ ] Deploy ejecutado sin errores
- [ ] Build completado
- [ ] App desplegada

#### Paso 4: Verificar deployment

```bash
# Ver estado
flyctl status -a hpn-vouchers-frontend

# Ver logs
flyctl logs -a hpn-vouchers-frontend

# Abrir en browser
flyctl open -a hpn-vouchers-frontend
```

- [ ] App responde 200 OK
- [ ] No hay errores en logs
- [ ] Frontend carga en el browser

#### Paso 5: Configurar CORS en backend

```bash
# Obtener URL del frontend
FRONTEND_URL=$(flyctl info -a hpn-vouchers-frontend | grep "Hostname" | awk '{print $2}')
echo "Frontend URL: https://${FRONTEND_URL}"

# Actualizar CORS
flyctl secrets set \
  CORS_ORIGIN="https://hpn-vouchers-backend.fly.dev,https://${FRONTEND_URL}" \
  -a hpn-vouchers-backend

# Reiniciar backend
flyctl apps restart hpn-vouchers-backend
```

- [ ] CORS actualizado en backend
- [ ] Backend reiniciado
- [ ] Frontend URL incluida en `CORS_ORIGIN`

#### Paso 6: Validar CORS

```bash
# Test CORS
curl -v \
  -H "Origin: https://hpn-vouchers-frontend.fly.dev" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS \
  https://hpn-vouchers-backend.fly.dev/api/auth/login

# Buscar: Access-Control-Allow-Origin: https://hpn-vouchers-frontend.fly.dev
```

- [ ] CORS funciona correctamente
- [ ] Headers `Access-Control-*` presentes en respuesta

#### Paso 7: Smoke test

```bash
# Ejecutar smoke test automatizado
./scripts/smoke-test-frontend.sh
```

- [ ] Todos los tests pasan
- [ ] Frontend responde 200
- [ ] Backend accesible desde frontend
- [ ] CORS OK
- [ ] SSL OK

#### Paso 8: Test manual en browser

```bash
# Abrir frontend
open https://hpn-vouchers-frontend.fly.dev
# O
flyctl open -a hpn-vouchers-frontend
```

**Tests manuales**:

- [ ] Página de login carga sin errores
- [ ] No hay errores de CORS en consola del browser (F12)
- [ ] Login funciona con credenciales válidas
- [ ] Dashboard carga datos correctamente
- [ ] Navegación entre páginas funciona
- [ ] No hay errores 404/500
- [ ] Assets (CSS, JS, images) cargan correctamente

---

## 📊 Post-deployment

### Monitoreo

```bash
# Logs en vivo
flyctl logs -a hpn-vouchers-frontend

# Estado de la app
flyctl status -a hpn-vouchers-frontend --watch

# Métricas del backend
curl https://hpn-vouchers-backend.fly.dev/metrics | grep http_requests_total
```

- [ ] No hay errores en logs
- [ ] App está "running"
- [ ] Requests llegan al backend

### Commit final

```bash
cd /home/eevan/ProyectosIA/SIST_VOUCHERS_HOTEL/vouchers-hostal-playa-norte/frontend

git add .
git commit -m "docs: update deployment checklist - production deployed"
git push origin main
```

- [ ] Checklist actualizado con URLs reales
- [ ] Cambios commiteados

---

## 🎉 Deployment completado

Si todos los checkboxes están marcados:

✅ **Frontend desplegado**: https://hpn-vouchers-frontend.fly.dev  
✅ **Backend funcionando**: https://hpn-vouchers-backend.fly.dev  
✅ **CORS configurado**: Frontend puede consumir backend  
✅ **Sistema en producción**: Listo para usar

---

## 📞 Troubleshooting rápido

### Error: "Failed to fetch"
→ Verificar CORS en backend: `flyctl secrets list -a hpn-vouchers-backend | grep CORS`

### Error: Build failed
→ Build local: `npm run build` y ver el error real

### Error: Health checks failing
→ Ver logs: `flyctl logs -a hpn-vouchers-frontend`

### Backend no responde
→ Restart: `flyctl apps restart hpn-vouchers-backend`

---

## 📝 Notas

- **Región**: gru (São Paulo) - baja latencia para Argentina
- **VM size**: shared-cpu-1x con 256MB RAM (configurable en fly.toml)
- **Scaling**: Auto-scaling configurado (min 1, max 3 instancias)
- **SSL**: Automático con Let's Encrypt
- **Dominio**: `hpn-vouchers-frontend.fly.dev` (custom domain opcional)

---

**Creado**: 2025-10-30  
**Última actualización**: [COMPLETAR MAÑANA]  
**Status**: ⏳ Ready to deploy
