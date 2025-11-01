# Voucher System Backend - Entorno de Desarrollo

## 🛠 Configuración Inicial

### Requisitos
- **Node.js**: 18.17.0+ (usar .nvmrc: `nvm use`)
- **npm**: 9.0.0+
- **VSCode**: Recomendado con extensiones incluidas

### Instalación
```bash
# Clonar e instalar dependencias
git clone <repo>
cd vouchers-hostal-playa-norte/backend
npm install

# Configurar base de datos
npm run db:init
npm run db:migrate
npm run db:seed
```

## 🚀 Scripts de Desarrollo

### Servidor
```bash
npm run dev          # Desarrollo con nodemon
npm run dev:debug    # Desarrollo con inspector Node.js
npm start           # Producción
npm run health      # Verificar salud del servidor
```

### Testing
```bash
npm test            # Tests completos con coverage
npm run test:unit   # Solo tests unitarios  
npm run test:watch  # Tests en modo watch
npm run test:debug  # Debug tests con inspector
```

### Calidad de Código
```bash
npm run lint        # Verificar ESLint
npm run lint:fix    # Auto-fix ESLint
npm run format      # Formatear con Prettier
npm run format:check # Verificar formato
npm run clean       # Limpiar archivos temporales
```

### Base de Datos
```bash
npm run db:init     # Inicializar DB
npm run db:migrate  # Ejecutar migraciones
npm run db:seed     # Poblar datos de prueba
```

## 🔧 Configuración VSCode

### Extensiones Recomendadas
- ESLint - Linting JavaScript
- Prettier - Formateo de código
- Jest - Testing framework
- Path Intellisense - Autocompletado rutas
- GitHub Copilot - Asistencia IA

### Configuración Automática
- **Format on Save**: ✅ Habilitado
- **ESLint Auto-Fix**: ✅ Habilitado  
- **Trailing Whitespace**: ✅ Eliminado automáticamente
- **Final Newline**: ✅ Insertado automáticamente

### Debug Configurations
- **Launch Backend**: Debug servidor principal
- **Jest Tests**: Debug todos los tests
- **Jest Current File**: Debug archivo actual

## 📁 Estructura del Proyecto

```
src/
├── application/         # Casos de uso y servicios de aplicación
├── domain/             # Entidades y reglas de negocio
├── infrastructure/     # Persistencia, seguridad, servicios externos
├── presentation/       # Routes, middleware, controladores
├── services/          # Servicios core del negocio
│   ├── experimental/  # Servicios experimentales (no en producción)
│   └── core services  # 9 servicios principales
└── config/            # Configuración de base de datos, logger, etc.
```

## 🔒 Pre-commit Hooks

Configurados automáticamente con Husky:
- **Prettier**: Formato automático
- **ESLint**: Linting automático  
- **Tests**: Ejecución tests unitarios

```bash
# Los hooks se ejecutan automáticamente en cada commit
git commit -m "mensaje"
```

## 🐛 Debugging

### Node.js Inspector
```bash
npm run dev:debug    # http://localhost:9229
npm run test:debug   # Debug tests
```

### VSCode Breakpoints
1. Abrir VSCode en carpeta backend
2. Establecer breakpoints en código
3. F5 → "Launch Backend" o "Jest Tests"

### Logs
```bash
# Logs disponibles en:
logs/combined.log     # Logs generales
logs/error.log       # Solo errores  
logs/audit.log       # Logs de auditoría
```

## 🧪 Testing

### Cobertura Actual
- **Total**: 14.51% (964/6642 statements)
- **Objetivo**: >90% cobertura
- **Tests pasando**: 154/187 (82.4%)

### Ejecutar Tests Específicos
```bash
# Por archivo
npm test -- vouchers.test.js

# Por patrón
npm test -- --testNamePattern="createVoucher"

# Con coverage específico
npm test -- --collectCoverageFrom="src/services/**"
```

## 📊 Monitoreo y Métricas

### Endpoints de Salud
```bash
curl http://localhost:3000/health    # Health check
curl http://localhost:3000/metrics   # Prometheus metrics  
curl http://localhost:3000/ready     # Readiness check
```

### Base de Datos
```bash
# Verificar conexión
npm run health

# Ver esquema
sqlite3 database/vouchers.db ".schema"
```

## 🔄 Workflow de Desarrollo

1. **Crear branch**: `git checkout -b feature/nueva-funcionalidad`
2. **Desarrollar**: Usar `npm run dev` para desarrollo
3. **Tests**: `npm run test:watch` durante desarrollo
4. **Lint**: Auto-fix con hooks pre-commit
5. **Commit**: Hooks automáticos verifican calidad
6. **Push**: `git push origin feature/nueva-funcionalidad`

## ⚡ Tips de Productividad

### Variables de Entorno
```bash
cp .env.example .env   # Configurar variables locales
```

### Atajos VSCode
- `Ctrl+Shift+P` → "Jest: Run Current Test"
- `F5` → Launch debugger
- `Ctrl+Shift+F` → Buscar en todos los archivos
- `Ctrl+` → Terminal integrado

### Hot Reload
```bash
npm run dev  # Reinicio automático con nodemon
```

---
**Última actualización**: Noviembre 2025 - FASE 1.5
