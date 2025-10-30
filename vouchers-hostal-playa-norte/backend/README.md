# 🏨 Backend - Sistema Vouchers Hotel

> API REST para gestión de vouchers y hospedajes en Hostal Playa Norte

![Status](https://img.shields.io/badge/status-production%20ready-brightgreen)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 📋 Tabla de Contenidos

- [Quick Start](#quick-start)
- [Arquitectura](#arquitectura)
- [Desarrollo](#desarrollo)
- [Testing](#testing)
- [Deployment](#deployment)
- [Documentación](#documentación)
- [FAQ](#faq)

---

## 🚀 Quick Start

### Requisitos

- **Node.js** 18+
- **npm** 9+
- **SQLite** 3 (incluido en better-sqlite3)
- **Fly.io CLI** (para deployment)

### Instalación local

```bash
# 1. Clonar y entrar
git clone <repo>
cd vouchers-hostal-playa-norte/backend

# 2. Instalar dependencias
npm install

# 3. Configurar entorno
cp .env.example .env
# Editar .env con valores locales

# 4. Iniciar
npm run dev
```

### Verificar que funciona

```bash
# Terminal 1: App corriendo en http://localhost:3000
npm run dev

# Terminal 2: Healthcheck
curl http://localhost:3000/health

# Esperado:
# {"status":"ok","timestamp":"...","environment":"development","database":"connected"}
```

---

## 🏗️ Arquitectura

```
src/
├── index.js                      # Punto de entrada
├── config/                       # Configuraciones
├── domain/                       # Lógica de negocio
│   ├── entities/                # Modelos de dominio
│   └── repositories/            # Repositorios de acceso a datos
├── infrastructure/              # Servicios técnicos
│   ├── security/               # JWT, Crypto, Password
│   └── services/               # QR, Email, etc.
├── application/                 # Casos de uso (Use Cases)
│   ├── use-cases/             # LoginUser, GenerateVoucher, etc.
│   └── services/              # ReportService, etc.
├── presentation/               # Capa HTTP
│   ├── http/
│   │   ├── routes/            # Rutas de API
│   │   └── middleware/        # Auth, Rate Limit, Error Handler
└── middleware/                # Middleware general (CORS, Security, etc.)

db/
└── vouchers.db               # Base de datos SQLite (dev)

docs/
├── OPERACION.md             # Runbook para ops
├── SECRETOS.md              # Gestión de secretos
├── QA_SMOKE_TESTS.md        # Checklist QA post-deploy
└── BLUEPRINT_ARQUITECTURA.md # Diseño técnico

scripts/
└── pre-deploy-check.sh      # Validación pre-deploy

Dockerfile                     # Multi-stage build para producción
fly.toml                       # Configuración Fly.io
.env.example                   # Variables de entorno
```

### Stack Tecnológico

| Capa | Tecnología | Propósito |
|------|-----------|----------|
| **Runtime** | Node.js 18+ (ESM) | Ejecución |
| **Framework** | Express.js | HTTP server |
| **DB** | SQLite (better-sqlite3) | Datos persistentes |
| **Auth** | JWT + bcryptjs | Autenticación |
| **Logging** | Winston | Logs estructurados |
| **Validación** | Zod | Schemas |
| **Testing** | Jest + Supertest | Unit + Integration |
| **Deploy** | Fly.io (Docker) | Producción |

---

## 👨‍💻 Desarrollo

### Scripts disponibles

```bash
npm run dev                 # Modo desarrollo (nodemon)
npm test                    # Ejecutar tests
npm run test:watch        # Tests en modo watch
npm run lint              # ESLint (si está configurado)
npm run build             # Compilar/optimizar
npm run start             # Producción local
npm run migrate           # Ejecutar migraciones DB
npm run seed              # Llenar DB con datos de prueba
```

### Desarrollo con nodemon

```bash
npm run dev
```

Detecta cambios automáticamente y reinicia. Logs en consola.

### Variables de entorno (desarrollo)

Crear `.env` basado en `.env.example`:

```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
LOG_TO_CONSOLE=true
DATABASE_PATH=./db/vouchers.db
JWT_SECRET=dev-secret-12345-change-in-prod
BCRYPT_ROUNDS=10
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```

---

## 🧪 Testing

### Ejecutar todos los tests

```bash
npm test
```

### Tests específicos

```bash
# Solo unit tests
npm test -- --testPathPattern="unit"

# Solo integration tests
npm test -- --testPathPattern="integration"

# Con coverage
npm test -- --coverage
```

### Estructura de tests

```
tests/
├── unit/
│   ├── domain/
│   ├── application/
│   └── infrastructure/
├── integration/
│   ├── routes/
│   └── middleware/
└── smoke/          # Smoke tests post-deploy
```

### Ejemplo: Test de login

```javascript
// tests/integration/routes/auth.test.js
describe('POST /api/auth/login', () => {
  test('debe retornar token con credenciales válidas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@hotel.com', password: 'Test123!' });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });
});
```

---

## 📦 Deployment

### A Fly.io (Producción)

#### Prerequisitos

```bash
# Instalar Fly.io CLI
curl -L https://fly.io/install.sh | sh

# Autenticarse
flyctl auth login

# Crear app (solo primera vez)
flyctl launch --name hpn-vouchers-backend --region gru --dockerfile
```

#### Deploy

```bash
# Validar configuración pre-deploy
scripts/pre-deploy-check.sh

# Deploy (build + push)
flyctl deploy --remote-only -a hpn-vouchers-backend

# Ver logs
flyctl logs -a hpn-vouchers-backend

# Ver estado
flyctl status -a hpn-vouchers-backend
```

#### Configurar secretos (primera vez)

```bash
# Generar secretos seguros
JWT_SECRET=$(openssl rand -base64 32)
VOUCHER_SECRET=$(openssl rand -base64 32)

# Cargar en Fly.io
flyctl secrets set JWT_SECRET="$JWT_SECRET" -a hpn-vouchers-backend
flyctl secrets set VOUCHER_SECRET="$VOUCHER_SECRET" -a hpn-vouchers-backend

# Verificar
flyctl secrets list -a hpn-vouchers-backend
```

#### Rollback

```bash
# Ver releases
flyctl releases -a hpn-vouchers-backend

# Volver a versión anterior
flyctl releases rollback -a hpn-vouchers-backend
```

### Dockerfile

- **Base image**: `node:18-bookworm-slim` (Debian)
- **Build**: Multi-stage (builder + runtime)
- **Init**: Tini (PID 1 para signal handling)
- **Non-root**: Usuario `nodejs` (1001)
- **Entrypoint**: `start.sh` con logging

---

## 📚 Documentación

| Documento | Propósito |
|-----------|----------|
| **[OPERACION.md](./docs/OPERACION.md)** | Runbook: arranque, parada, backup, troubleshooting |
| **[SECRETOS.md](./docs/SECRETOS.md)** | Gestión de secretos: JWT, VOUCHER_SECRET, rotación |
| **[QA_SMOKE_TESTS.md](./docs/QA_SMOKE_TESTS.md)** | Checklist QA y smoke tests post-deploy |
| **[BLUEPRINT_ARQUITECTURA.md](./docs/BLUEPRINT_ARQUITECTURA.md)** | Diseño técnico detallado |

---

## 🔐 Seguridad

### Medidas implementadas

- ✅ **Autenticación**: JWT con refresh tokens
- ✅ **Encripción**: bcryptjs para passwords, crypto para vouchers
- ✅ **Headers**: Helmet (CSP, HSTS, X-Frame-Options, etc.)
- ✅ **CORS**: Dinámico por entorno (whitelist)
- ✅ **Rate Limiting**: Global + específico por endpoint
- ✅ **Validación**: Zod para schemas
- ✅ **HTTPS**: Obligatorio en producción (Fly.io)
- ✅ **Logging**: Auditoría de acciones críticas

### Checklist de seguridad pre-deploy

```bash
scripts/pre-deploy-check.sh
```

Valida:
- Secretos no hardcodeados
- .env.example actualizado
- fly.toml configurado
- Dockerfile seguro
- Tests pasando

---

## 🆘 FAQ

### ¿Cómo reiniciar la app en Fly.io?

```bash
flyctl machines restart <MACHINE_ID> -a hpn-vouchers-backend
# o
flyctl machines stop <MACHINE_ID> -a hpn-vouchers-backend
flyctl machines start <MACHINE_ID> -a hpn-vouchers-backend
```

### ¿Cómo ver logs en tiempo real?

```bash
flyctl logs -a hpn-vouchers-backend
```

### ¿Cómo hacer backup de la DB?

Ver [OPERACION.md - Backups y restore](./docs/OPERACION.md#backups-y-restore)

### ¿Dónde está la base de datos en producción?

En Fly.io, volumen persistente: `/data/vouchers.db`

### ¿Cómo rotar secretos?

Ver [SECRETOS.md - Rotación de secretos](./docs/SECRETOS.md#rotación-de-secretos)

### ¿Qué hacer si la app no arranca?

1. Ver logs: `flyctl logs -a hpn-vouchers-backend --no-tail`
2. Revisar [OPERACION.md - Troubleshooting](./docs/OPERACION.md#troubleshooting)
3. Considerar rollback si fue reciente: `flyctl releases rollback -a hpn-vouchers-backend`

### ¿Cómo monitorear performance?

Ver latencias en:
- Healthcheck: `https://hpn-vouchers-backend.fly.dev/health`
- Logs: `flyctl logs -a hpn-vouchers-backend`

Para alertas avanzadas, considerar Prometheus/Grafana (pendiente).

---

## 📝 Contribuciones

### Flujo de desarrollo

1. **Fork** y clonar repo
2. Crear rama: `git checkout -b feature/tu-feature`
3. Hacer cambios y tests
4. Commit: `git commit -m "feat: descripción"`
5. Push: `git push origin feature/tu-feature`
6. Crear Pull Request

### Code Style

- ESM modules
- Async/await (no callbacks)
- Jsdoc para funciones públicas
- Tests para lógica crítica

---

## 📄 Licencia

MIT

---

## 👥 Contacto

- **Proyecto**: Sistema Vouchers Hotel
- **Repositorio**: [GitHub](https://github.com/eevans-d/SIST_VOUCHERS_HOTEL)
- **Documentación**: Ver carpeta `/docs`

---

**Última actualización**: 2025-01-15  
**Versión**: 1.0.0  
**Estado**: ✅ Production Ready
