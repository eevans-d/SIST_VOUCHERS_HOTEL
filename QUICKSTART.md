# 🚀 QUICK START - Sistema Vouchers Hotel

**Durée total:** ~5 minutos  
**Prerequisitos:** Node.js 18+, npm 9+, SQLite3

---

## 1️⃣ SETUP (2 min)

```bash
# Clonar/navegar al directorio
cd /home/eevan/ProyectosIA/SIST_VOUCHERS_HOTEL/vouchers-hostal-playa-norte/backend

# Instalar dependencias
npm install

# Copiar configuración
cp .env.example .env
```

---

## 2️⃣ CONFIGURAR BASE DE DATOS (1 min)

```bash
# Crear DB y tablas
sqlite3 db/vouchers.db < db/schema.sql

# Verificar
sqlite3 db/vouchers.db ".tables"
# Output: users cafeterias stays vouchers redemptions sync_log
```

---

## 3️⃣ INICIAR SERVIDOR (1 min)

```bash
# Modo desarrollo (con auto-reload)
npm run dev

# Output esperado:
# 🏛️  SISTEMA VOUCHERS HOTEL
# Backend API - Constitucional
# 🌐 URL: http://localhost:3005
```

---

## 4️⃣ PROBAR API (1 min)

### A. Registrar usuario
```bash
curl -X POST http://localhost:3005/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "confirmPassword": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Response 201
```

### B. Login
```bash
curl -X POST http://localhost:3005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'

# Response: { accessToken, refreshToken, user }
# Guardar accessToken para paso C
```

### C. Obtener perfil (con token)
```bash
curl -X GET http://localhost:3005/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"

# Response: { user profile con permisos }
```

### D. Health check
```bash
curl http://localhost:3005/health

# Response: { status: "ok", timestamp, environment }
```

---

## 📁 Estructura Principal

```
vouchers-hostal-playa-norte/
├── backend/
│   ├── src/
│   │   ├── domain/          (Entities, Repositories)
│   │   ├── application/     (Use Cases)
│   │   ├── infrastructure/  (Services, Persistence)
│   │   ├── presentation/    (Routes, Middleware)
│   │   └── index.js         (Entry point)
│   ├── tests/
│   │   └── unit/
│   ├── db/
│   │   ├── schema.sql       (SQL schema)
│   │   └── vouchers.db      (SQLite database)
│   ├── logs/
│   ├── .env                 (Variables de entorno)
│   └── package.json
└── pwa-cafeteria/           (Frontend React)
```

---

## 🔧 Comandos Útiles

```bash
# Test unitarios
npm run test:unit

# Linting
npm run lint

# Formatear código
npm run format

# Ejecutar en producción
npm run start

# Ejecutar migrations (futuro)
npm run db:migrate

# Seed database (futuro)
npm run db:seed
```

---

## 📚 Documentación

| Documento | Contenido |
|-----------|----------|
| [README_CONSTITUCIONAL.md](../README_CONSTITUCIONAL.md) | Índice maestro |
| [MODULO_1_README.md](./MODULO_1_README.md) | Detalles de autenticación |
| [IMPLEMENTACION_LOG.md](../IMPLEMENTACION_LOG.md) | Log de implementación |
| [BLUEPRINT_ARQUITECTURA.md](../BLUEPRINT_ARQUITECTURA.md) | Diagramas C4 |

---

## 🚨 Troubleshooting

### Puerto 3005 ocupado
```bash
# Cambiar PORT en .env
PORT=3006

# O matar proceso
lsof -ti :3005 | xargs kill -9
```

### Base de datos corrupta
```bash
# Backup y recrear
mv db/vouchers.db db/vouchers.db.bak
sqlite3 db/vouchers.db < db/schema.sql
```

### npm install falla
```bash
# Limpiar cache
rm -rf node_modules package-lock.json
npm install
```

---

## 🎯 Próximos Pasos

1. ✅ **Actual:** Autenticación funcionando
2. ⏳ **Próximo:** MÓDULO 2 - Implementar Estadías (Stay)
3. ⏳ **Luego:** MÓDULO 3 - Sistema de Vouchers

---

**¿Preguntas?** Ver [MODULO_1_README.md](./MODULO_1_README.md)
