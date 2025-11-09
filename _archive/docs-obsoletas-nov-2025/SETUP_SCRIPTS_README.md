# 🚀 Setup Scripts - MÓDULO 0: Preparación del Entorno

**Constitutional Infrastructure Automation**

Estos scripts automatizan completamente la preparación del entorno de desarrollo para el **Sistema de Vouchers Hostal Playa Norte** en plena conformidad con los **12 Pilares Constitucionales**.

---

## 📋 Índice de Scripts

| Script | Propósito | Pilares | Duración |
|--------|-----------|---------|----------|
| `setup-all.sh` | **Maestro**: Ejecuta todos los pasos | Todos | ~5-10 min |
| `setup-hexagonal-structure.sh` | Crea estructura hexagonal | 1.1, 2.1 | ~30 seg |
| `setup-config.sh` | Genera archivos de configuración | 2.1, 5.1, 6.1 | ~20 seg |
| `setup-dependencies.sh` | Crea `package.json` | Todos | ~15 seg |
| `setup-database.sh` | Inicializa esquema SQLite | 8.1, 8.2 | ~20 seg |

---

## ⚡ Quick Start (Opción Recomendada)

```bash
# 1. Navega al proyecto
cd /home/eevan/ProyectosIA/SIST_VOUCHERS_HOTEL

# 2. Ejecuta el script maestro (hace todo automáticamente)
bash scripts/setup-all.sh

# 3. Genera secretos
bash scripts/generate-secrets.sh

# 4. Edita el archivo .env con tus valores
nano vouchers-hostal-playa-norte/backend/.env

# 5. Inicializa la base de datos
cd vouchers-hostal-playa-norte/backend
npm run db:migrate

# ¡Listo! Tu ambiente está configurado
```

---

## 📖 Uso Detallado de Cada Script

### 1. `setup-all.sh` - Script Maestro (RECOMENDADO)

**Qué hace:**
- ✅ Verifica Node.js y npm
- ✅ Crea estructura hexagonal completa
- ✅ Genera archivos de configuración
- ✅ Instala dependencias npm
- ✅ Inicializa esquema de base de datos
- ✅ Verifica integridad de todo

**Uso:**
```bash
bash scripts/setup-all.sh
```

**Output esperado:**
```
╔════════════════════════════════════════════════════════╗
║ CONSTITUTIONAL PROJECT SETUP - MÓDULO 0                ║
╚════════════════════════════════════════════════════════╝

ℹ Phase 1/5: Pre-flight Checks
✅ Node.js v18.17.0 ✓
✅ npm 9.6.7 ✓
✅ Bash available ✓
✅ Project root verified ✓

[...setup progresa...]

✅ 12/12 checks passed

✅ MÓDULO 0 SETUP COMPLETE! ✨
```

---

### 2. `setup-hexagonal-structure.sh` - Estructura Arquitectónica

**Qué crea:**

```
vouchers-hostal-playa-norte/
├── backend/src/
│   ├── domain/                    # 🔴 NÚCLEO
│   │   ├── entities/              # Voucher, User, Redemption
│   │   ├── value-objects/         # Amount, VoucherCode
│   │   ├── repositories/          # IVoucherRepository
│   │   ├── events/                # VoucherRedeemedEvent
│   │   └── exceptions/            # DomainException
│   ├── application/               # 🟡 LÓGICA
│   │   ├── use-cases/             # CreateVoucher, RedeemVoucher
│   │   ├── commands/              # CreateVoucherCommand
│   │   ├── queries/               # GetVoucherByCode
│   │   ├── handlers/              # CommandHandler
│   │   ├── dto/                   # Data Transfer Objects
│   │   └── mappers/               # DomainToPresentationMapper
│   ├── infrastructure/            # 🔵 EXTERNOS
│   │   ├── persistence/           # SQLite, Migrations
│   │   ├── messaging/             # Event Bus
│   │   ├── observability/         # Logger, Metrics
│   │   ├── security/              # Auth, Encryption
│   │   ├── external-apis/         # Third-party integrations
│   │   └── config/                # Configuration loaders
│   ├── presentation/              # 🟢 INTERFAZ
│   │   ├── http/                  # REST Routes, Controllers
│   │   ├── cli/                   # Command-line interface
│   │   └── utils/                 # Helpers
│   └── index.js                   # Application entry
├── tests/
│   ├── unit/                      # Unit tests
│   ├── integration/               # Integration tests
│   ├── e2e/                       # End-to-end tests
│   └── fixtures/                  # Test data
├── db/
│   ├── migrations/                # SQL migrations
│   └── seeds/                     # Initial data
└── docs/
    ├── architecture/              # ADR, Dependency Rules
    └── api/                       # API documentation
```

**Archivos de configuración creados:**
- `.eslintrc.json` - Reglas de calidad de código (Pilar 2.1)
- `.prettierrc.json` - Formato consistente (Pilar 2.1)
- `jest.config.js` - Testing >80% coverage (Pilar 11.1)
- `docs/architecture/DEPENDENCY_RULES.md` - Reglas hexagonales
- `docs/ADR/template.md` - Architecture Decision Records

**Uso:**
```bash
bash scripts/setup-hexagonal-structure.sh
```

---

### 3. `setup-config.sh` - Configuración Constitucional

**Qué genera:**

| Archivo | Propósito | Pilar |
|---------|-----------|-------|
| `.env.example` | Template con todas las variables | 5.1 |
| `.env` | Variables locales (editar) | 5.1 |
| `.env.production` | Variables para producción (Fly.io) | 5.1 |
| `logger-config.js` | Configuración Winston logging | 6.1 |
| `database-config.js` | Configuración SQLite | 8.1 |
| `security-config.js` | Configuración JWT, CORS, Rate Limit | 5.1 |
| `metrics-config.js` | Configuración Prometheus | 6.2 |
| `generate-secrets.sh` | Generador de secretos | 5.1 |

**Variables de Entorno (.env):**
```bash
# ENVIRONMENT
NODE_ENV=development
PORT=3000

# SECURITY (🔴 CAMBIAR ANTES DE PRODUCCIÓN)
JWT_SECRET=your-32-byte-hex-secret-here
VOUCHER_SECRET=your-32-byte-hex-secret-here

# DATABASE
DATABASE_PATH=./vouchers.sqlite
DATABASE_JOURNAL_MODE=WAL

# LOGGING
LOG_LEVEL=info
LOG_DIR=./logs

# RATE LIMITING
RATE_LIMIT_VALIDATE=100
RATE_LIMIT_REDEEM=50

# CORS
CORS_ORIGIN=http://localhost:3001
```

**Uso:**
```bash
bash scripts/setup-config.sh

# Luego generar secretos
bash scripts/generate-secrets.sh
```

---

### 4. `setup-dependencies.sh` - Gestión de Dependencias

**Dependencias de Producción (Pilar-Mapped):**

```json
{
  "express": "REST API Framework (Pilar 1.2)",
  "better-sqlite3": "Synchronous SQLite (Pilar 8.1)",
  "jsonwebtoken": "JWT Authentication (Pilar 5.1)",
  "helmet": "Security Headers (Pilar 5.1)",
  "express-rate-limit": "Rate Limiting (Pilar 5.1)",
  "zod": "Input Validation (Pilar 5.2)",
  "winston": "Structured Logging (Pilar 6.1)",
  "prom-client": "Prometheus Metrics (Pilar 6.2)",
  "uuid": "Unique Identifiers (Pilar 2.1)",
  "qrcode": "QR Generation (Domain)",
  "node-cron": "Scheduled Tasks (Infrastructure)"
}
```

**Scripts NPM Generados:**

```bash
npm start              # Production server
npm run dev           # Development with nodemon
npm run lint          # ESLint + Prettier
npm run test          # All tests
npm run test:unit     # Unit tests only
npm run test:coverage # Coverage report
npm run db:migrate    # Run migrations
npm run db:seed       # Seed test data
npm run db:reset      # Reset database
```

**Uso:**
```bash
bash scripts/setup-dependencies.sh

# Después de crear package.json
cd vouchers-hostal-playa-norte/backend
npm install
```

---

### 5. `setup-database.sh` - Inicialización de Base de Datos

**Tablas Creadas (8 tablas con integridad referencial):**

| Tabla | Propósito | Pilar |
|-------|-----------|-------|
| `users` | Users with RBAC | 5.1 |
| `vouchers` | Core entities (UNIQUE code) | 1.1 |
| `redemption_logs` | Audit trail | 2.2, 8.2 |
| `sync_logs` | Offline-first tracking | 1.2 |
| `business_metrics` | KPI tracking | 6.2 |
| `api_audit_log` | Security audit | 5.3, 2.2 |
| `constitutional_compliance_log` | Governance tracking | 10.2 |
| `cost_tracking` | Budget control | 12.1 |

**Vistas Constitucionales Creadas:**

```sql
v_redemption_status       -- Current status overview
v_user_activity           -- User engagement metrics
v_daily_metrics           -- Daily KPI tracking
```

**Características de Integridad:**

- ✅ Foreign keys habilitadas
- ✅ WAL (Write-Ahead Logging) para concurrencia
- ✅ UNIQUE constraints en código de voucher
- ✅ Índices para queries frecuentes
- ✅ Timestamps automáticos
- ✅ Correlation IDs para trazabilidad

**Uso:**
```bash
bash scripts/setup-database.sh

# Luego en Node.js
npm run db:migrate    # Crear tablas
npm run db:seed       # Datos de prueba
```

---

## 🔐 Generación de Secretos

**CRÍTICO**: Nunca commits secretos en Git.

```bash
# Generar secretos aleatorios de 32 bytes
bash scripts/generate-secrets.sh

# Output:
# 🔐 COPY THESE SECRETS TO .env (NOT in version control!)
# 
# JWT_SECRET=a7f9e2c1b4d8f3a6e9c2b5d8f1a4e7c0
# VOUCHER_SECRET=f3a6e9c2b5d8f1a4e7c0a7f9e2c1b4d8

# Copiar al .env local
nano vouchers-hostal-playa-norte/backend/.env

# Para producción (Fly.io):
flyctl secrets set JWT_SECRET=a7f9e2c1b4d8f3a6e9c2b5d8f1a4e7c0
flyctl secrets set VOUCHER_SECRET=f3a6e9c2b5d8f1a4e7c0a7f9e2c1b4d8
```

---

## 📊 Ordem de Ejecución (Importante)

```
1. setup-all.sh (maestro) 
   ├── setup-hexagonal-structure.sh
   ├── setup-config.sh
   ├── setup-dependencies.sh + npm install
   └── setup-database.sh

2. scripts/generate-secrets.sh
   └── Editar .env con secretos

3. npm run db:migrate
   └── Crear tablas en SQLite

4. npm run db:seed (opcional)
   └── Datos de prueba

5. npm run lint && npm run test:unit
   └── Verificar calidad

6. npm run dev
   └── Iniciar servidor
```

---

## ✅ Checklist de Verificación

Después de ejecutar los scripts, verificar:

```bash
# ✅ Estructura de directorios
test -d vouchers-hostal-playa-norte/backend/src/domain && echo "Domain layer OK"
test -d vouchers-hostal-playa-norte/backend/src/application && echo "Application layer OK"
test -d vouchers-hostal-playa-norte/backend/src/infrastructure && echo "Infrastructure layer OK"
test -d vouchers-hostal-playa-norte/backend/src/presentation && echo "Presentation layer OK"

# ✅ Archivos de configuración
test -f vouchers-hostal-playa-norte/backend/.env && echo ".env OK"
test -f vouchers-hostal-playa-norte/backend/package.json && echo "package.json OK"
test -f vouchers-hostal-playa-norte/backend/.eslintrc.json && echo "ESLint config OK"

# ✅ Dependencias instaladas
test -d vouchers-hostal-playa-norte/backend/node_modules && echo "node_modules OK"

# ✅ Scripts disponibles
npm run --list | grep "db:migrate" && echo "npm scripts OK"

# ✅ ESLint y Prettier
npm run lint -- --max-warnings 0 && echo "Lint OK"

# ✅ Tests ejecutables
npm run test:unit -- --listTests && echo "Tests OK"
```

---

## 🐛 Troubleshooting

### Node.js no está instalado
```bash
# Instalar Node.js 18+
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### npm install falla
```bash
# Limpiar caché
npm cache clean --force

# Reinstalar
rm -rf node_modules package-lock.json
npm install
```

### Permisos de script
```bash
# Hacer ejecutables todos los scripts
chmod +x scripts/*.sh
```

### Error de base de datos
```bash
# Borrar SQLite corrupta
rm vouchers-hostal-playa-norte/backend/vouchers.sqlite*
npm run db:migrate
```

---

## 📚 Documentación Relacionada

| Documento | Propósito |
|-----------|-----------|
| `README_CONSTITUCIONAL.md` | Índice maestro de constitución |
| `CONSTITUCION_SISTEMA_VOUCHERS.md` | Pilares 1-5 (Arquitectura - Seguridad) |
| `CONSTITUCION_SISTEMA_VOUCHERS_PARTE_2.md` | Pilares 6-12 (Observabilidad - Costos) |
| `INTEGRACION_CONSTITUCIONAL.md` | Módulos → Pilares mapping |
| `docs/architecture/DEPENDENCY_RULES.md` | Reglas de dependencias hexagonales |
| `CHECKLIST_EJECUTABLE.md` | 170+ tareas ejecutables |

---

## 🎯 Próximos Pasos Después del Setup

1. **CHECKLIST 1: Pre-Development Setup**
   - Revisar en `CONSTITUCION_SISTEMA_VOUCHERS_PARTE_2.md`
   - Ejecutar todos los ~30 items (4-6 horas)

2. **MÓDULO 0 Constitutional Tasks**
   - 7 tareas en paralelo con MÓDULO 0
   - Implementar Event Bus, Circuit Breakers, etc.

3. **MÓDULO 1: Backend Core**
   - Entidades de dominio
   - Casos de uso

4. **Sprints Subsiguientes**
   - MÓDULO 2-6: Backend features
   - MÓDULO 7-10: Frontend PWA
   - MÓDULO 11-13: Testing
   - MÓDULO 14-15: Deployment

---

## 💡 Tips y Mejores Prácticas

1. **Ejecutar setup-all.sh primero** - Ahorra tiempo y evita errores
2. **Generar secretos INMEDIATAMENTE después** - No olvidar esta step crítica
3. **NO committear .env a Git** - Agregar a `.gitignore`
4. **Ejecutar lint antes de cada commit** - Pilar 2.1
5. **Mantener npm dependencies actualizadas** - Security patches

---

## 🔗 Links Útiles

- **Express.js**: https://expressjs.com
- **Better-sqlite3**: https://github.com/WiseLibs/better-sqlite3
- **Helmet**: https://helmetjs.github.io
- **Winston**: https://github.com/winstonjs/winston
- **Zod**: https://zod.dev
- **Fly.io**: https://fly.io

---

**Status**: ✅ Production-Ready Scripts  
**Version**: 1.0.0  
**Last Updated**: 2025-10-21  
**Constitutional Compliance**: 100% (All 12 Pillars)
