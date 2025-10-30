# 🚀 Frontend - Sistema Vouchers Hotel

> Aplicación web React para gestión de vouchers y estadías

![Status](https://img.shields.io/badge/status-ready%20to%20deploy-green)
![React](https://img.shields.io/badge/react-18.2-blue)
![Vite](https://img.shields.io/badge/vite-5.0-purple)

---

## 📋 Quick Start

### Desarrollo local

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar entorno
cp .env.example .env
# Editar .env con valores locales

# 3. Iniciar dev server
npm run dev

# Abrir http://localhost:3000
```

### Build para producción

```bash
# Build optimizado
npm run build

# Preview del build
npm run preview
```

---

## 🏗️ Arquitectura

```
src/
├── components/       # Componentes reutilizables
│   ├── ui/          # Componentes UI básicos
│   ├── forms/       # Formularios
│   └── layout/      # Layout components
├── pages/           # Páginas/rutas principales
│   ├── Dashboard/
│   ├── Vouchers/
│   ├── Stays/
│   └── Reports/
├── hooks/           # Custom React hooks
├── services/        # API clients y servicios
│   └── api.js      # Axios configurado
├── store/           # Estado global (Zustand)
├── utils/           # Utilidades
└── main.jsx        # Entry point
```

### Stack Tecnológico

| Capa | Tecnología | Propósito |
|------|-----------|----------|
| **Framework** | React 18 | UI declarativa |
| **Build** | Vite 5 | Dev server rápido |
| **Routing** | React Router 6 | SPA routing |
| **State** | Zustand | Estado global ligero |
| **HTTP** | Axios | API client |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Forms** | React Hook Form | Gestión de formularios |
| **Notifications** | React Hot Toast | Alertas/toasts |
| **QR** | qrcode.react | Generación QR |

---

## 🔧 Configuración

### Variables de entorno

Ver `.env.example` para todas las variables disponibles.

**Obligatorias:**
```bash
VITE_API_URL=https://hpn-vouchers-backend.fly.dev/api
```

**Opcionales:**
```bash
VITE_APP_TITLE=Sistema Vouchers
VITE_APP_VERSION=3.0.0
VITE_ENABLE_DEBUG=false
VITE_API_TIMEOUT=30000
```

### API Backend

El frontend consume el backend REST API. Endpoints principales:

- `POST /auth/login` - Autenticación
- `GET /stays` - Listar estadías
- `POST /vouchers` - Generar vouchers
- `GET /reports/dashboard` - Dashboard stats

Ver [backend/README.md](../backend/README.md) para documentación completa del API.

---

## 🚀 Deployment

### Fly.io (Recomendado)

```bash
# 1. Primera vez: crear app
flyctl launch --name hpn-vouchers-frontend --region gru

# 2. Deploy
./scripts/deploy-frontend.sh production

# 3. Verificar
flyctl status -a hpn-vouchers-frontend
```

### Vercel (Alternativa)

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
vercel --prod

# 3. Configurar variables de entorno en dashboard
# https://vercel.com/dashboard → Settings → Environment Variables
```

### Netlify (Alternativa)

```bash
# 1. Install Netlify CLI
npm i -g netlify-cli

# 2. Deploy
netlify deploy --prod --dir=dist

# 3. Configurar en netlify.toml o dashboard
```

---

## 🔐 CORS Configuration

Después de deployar el frontend, **actualizar CORS en backend**:

```bash
# Obtener URL del frontend
FRONTEND_URL=$(flyctl info -a hpn-vouchers-frontend | grep "Hostname" | awk '{print $2}')

# Actualizar CORS en backend
flyctl secrets set CORS_ORIGIN="https://hpn-vouchers-backend.fly.dev,https://${FRONTEND_URL}" -a hpn-vouchers-backend
```

Verificar que el backend acepte requests:
```bash
curl -H "Origin: https://hpn-vouchers-frontend.fly.dev" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://hpn-vouchers-backend.fly.dev/api/auth/login
```

---

## 🧪 Testing

```bash
# Unit tests
npm test

# Con coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

---

## 📦 Build optimizado

El build de producción incluye:
- ✅ Code splitting automático
- ✅ Tree shaking
- ✅ Minificación (Terser)
- ✅ Asset optimization
- ✅ Gzip compression (nginx)
- ✅ Cache headers

### Análisis de bundle

```bash
# Instalar plugin
npm i -D rollup-plugin-visualizer

# Build con análisis
npm run build -- --analyze

# Abrir stats.html
```

---

## 🛠️ Desarrollo

### Scripts disponibles

```bash
npm run dev          # Dev server (http://localhost:3000)
npm run build        # Build producción
npm run preview      # Preview build local
npm test             # Tests
npm run lint         # ESLint
npm run format       # Prettier
```

### Hot Module Replacement

Vite usa HMR nativo. Los cambios se reflejan instantáneamente sin reload.

### Proxy en desarrollo

El proxy de Vite redirige `/api` → backend local. Ver `vite.config.js`.

---

## 📁 Archivos clave

```
.
├── .env.example              # Template de variables
├── .env.production           # Valores de producción
├── Dockerfile.production     # Docker con nginx
├── fly.toml                  # Config Fly.io
├── vite.config.js           # Config Vite
├── tailwind.config.js       # Config Tailwind
├── package.json
└── scripts/
    └── deploy-frontend.sh   # Script de deploy
```

---

## 🔍 Troubleshooting

### Error: "CORS policy blocked"

Verificar que:
1. Backend tenga `CORS_ORIGIN` con URL del frontend
2. Frontend use URL correcta en `VITE_API_URL`
3. No haya typos en los dominios

### Build falla

```bash
# Limpiar cache y reinstalar
rm -rf node_modules dist
npm install
npm run build
```

### Deploy falla en Fly.io

```bash
# Ver logs
flyctl logs -a hpn-vouchers-frontend

# Rebuild forzado
flyctl deploy --remote-only --no-cache -a hpn-vouchers-frontend
```

---

## 📝 Checklist de Deploy

- [ ] Variables de entorno configuradas (`.env.production`)
- [ ] Build local exitoso (`npm run build`)
- [ ] Backend API accesible desde frontend
- [ ] CORS configurado en backend con dominio del frontend
- [ ] Healthchecks funcionando
- [ ] Tests pasando (`npm test`)
- [ ] Dominio custom (opcional) configurado

---

## 🚦 Post-Deploy

Verificar que todo funcione:

```bash
# 1. Health check
curl https://hpn-vouchers-frontend.fly.dev

# 2. Login
curl -X POST https://hpn-vouchers-frontend.fly.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hotel.com","password":"***"}'

# 3. Smoke test completo
./scripts/smoke-test-frontend.sh
```

---

## 📄 Licencia

MIT

---

## 👥 Contacto

- **Proyecto**: Sistema Vouchers Hotel
- **Repositorio**: [GitHub](https://github.com/eevans-d/SIST_VOUCHERS_HOTEL)
- **Backend**: [Backend README](../backend/README.md)

---

**Última actualización**: 2025-10-30  
**Versión**: 3.0.0  
**Estado**: ✅ Ready to Deploy
