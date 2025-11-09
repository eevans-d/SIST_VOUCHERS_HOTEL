# 🚀 Guía de Ejecución del Sistema

## Requisitos Previos

```bash
- Node.js 18+
- npm 8+
- SQLite 3+
- Git
```

## Instalación Rápida

### 1. Clonar el Repositorio
```bash
cd /home/eevan/ProyectosIA/SIST_VOUCHERS_HOTEL
```

### 2. Instalar Dependencias
```bash
cd vouchers-hostal-playa-norte/backend
npm install
```

### 3. Configurar Variables de Entorno
```bash
# Copiar template
cp .env.example .env

# Editar según tus valores
nano .env
```

### 4. Inicializar Base de Datos
```bash
bash scripts/init-database.sh
```

### 5. Ejecutar Server
```bash
npm start
```

**Output esperado:**
```
🚀 Iniciando aplicación en modo: development
✅ Base de datos conectada: ./db/vouchers.db
✅ Servicios inicializados correctamente
🏃 Server escuchando en puerto 3005
```

---

## 📍 Endpoints de Prueba (Postman/cURL)

### Health Check
```bash
curl http://localhost:3005/health
```

### Registro de Usuario
```bash
curl -X POST http://localhost:3005/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hotel.com",
    "password": "SecurePass123",
    "fullName": "Administrador Hotel"
  }'
```

### Login
```bash
curl -X POST http://localhost:3005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hotel.com",
    "password": "SecurePass123"
  }'
```

### Crear Estadía
```bash
curl -X POST http://localhost:3005/api/stays \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "hotelCode": "PLAYA-NORTE",
    "roomNumber": "101",
    "checkInDate": "2025-10-22",
    "checkOutDate": "2025-10-25",
    "numberOfGuests": 2,
    "roomType": "DOUBLE",
    "basePrice": 100
  }'
```

### Generar Voucher
```bash
curl -X POST http://localhost:3005/api/vouchers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "stayId": "<stay-id-from-previous>"
  }'
```

### Crear Orden
```bash
curl -X POST http://localhost:3005/api/orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "stayId": "<stay-id>",
    "items": [
      {
        "productCode": "CAFE",
        "productName": "Café Americano",
        "quantity": 2,
        "unitPrice": 3.50
      }
    ]
  }'
```

---

## 🧪 Ejecutar Tests

### Tests Unitarios
```bash
npm test
```

### Tests con Cobertura
```bash
npm test -- --coverage
```

### Test Específico
```bash
npm test tests/unit/entities/Voucher.test.js
```

---

## 📊 Explorar Base de Datos

### Abrir BD con SQLite CLI
```bash
sqlite3 ./db/vouchers.db

# Queries útiles:
SELECT * FROM users;
SELECT * FROM stays;
SELECT * FROM vouchers;
SELECT * FROM orders;
```

---

## 📝 Logs

### Ver Logs en Tiempo Real
```bash
tail -f logs/combined.log
```

### Ver Solo Errores
```bash
tail -f logs/error.log
```

---

## 🔧 Variables de Entorno (.env)

```env
# Server
PORT=3005
NODE_ENV=development

# Database
DATABASE_PATH=./db/vouchers.db

# Security
JWT_SECRET=your-super-secret-key-min-32-characters-long
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-characters
BCRYPT_ROUNDS=10

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3005

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

---

## 📚 Documentación Completa

| Documento | Contenido |
|-----------|----------|
| RESUMEN_EJECUTIVO_FINAL.md | Visión general del proyecto |
| README_CONSTITUCIONAL.md | 12 Pilares Constitucionales |
| MODULO_1_README.md | API de Autenticación |
| MODULO_2_README.md | API de Estadías |
| MODULO_3_README.md | API de Vouchers |
| MODULO_4_README.md | API de Órdenes |
| BLUEPRINT_ARQUITECTURA.md | Diagramas de arquitectura |
| STATUS.md | Estado actual del proyecto |

---

## 🐛 Troubleshooting

### Error: "Port 3005 already in use"
```bash
# Cambiar puerto en .env
PORT=3006
```

### Error: "Database locked"
```bash
# Eliminar WAL files y reiniciar
rm db/vouchers.db-wal
rm db/vouchers.db-shm
npm start
```

### Error: "JWT token invalid"
```bash
# Regenerar token con nuevo login
POST /api/auth/login
```

### Tests fallan
```bash
# Limpiar y reinstalar
rm -rf node_modules package-lock.json
npm install
npm test
```

---

## 🚀 Deployment a Producción

### 1. Cambiar a Modo Production
```bash
NODE_ENV=production
```

### 2. Usar BD de Producción
```bash
DATABASE_PATH=/var/lib/vouchers.db
```

### 3. Usar PM2 para Mantener Proceso Vivo
```bash
npm install -g pm2
pm2 start src/index.js --name "vouchers-api"
pm2 save
```

### 4. Configurar Nginx como Proxy Reverso
```nginx
server {
    listen 80;
    server_name api.vouchers-hotel.com;
    
    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

### 5. SSL con Let's Encrypt
```bash
certbot certonly --webroot -w /var/www/html \
  -d api.vouchers-hotel.com
```

---

## 📞 Soporte

### Contactos
- **Issues:** Revisar GitHub issues
- **Documentación:** Ver archivos README de cada módulo
- **Logs:** Revisar `logs/combined.log` para errores

---

## 📋 Checklist Pre-Deployment

- [ ] `.env` configurado con valores reales
- [ ] BD inicializada y poblada
- [ ] Tests pasando (85%+ cobertura)
- [ ] JWT secrets cambiados
- [ ] CORS origin configurado
- [ ] HTTPS habilitado
- [ ] Logs monitoreados
- [ ] Backups planificados
- [ ] Rate limiting ajustado
- [ ] Documentación actualizada

---

## 🎉 ¡Listo!

El sistema está completamente configurado y listo para:
- Pruebas locales
- Integración con frontend
- Deployment a producción
- Monitoreo y mantenimiento

**¡Disfruta del Sistema de Vouchers Hotel! 🏨✨**
