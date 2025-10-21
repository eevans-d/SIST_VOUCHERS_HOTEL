# 🏨 Sistema de Vouchers Digitales - Hostal Playa Norte

Sistema completo de gestión de vouchers de desayuno con soporte offline, sincronización automática y generación de QR.

## 📋 Características

- ✅ **Emisión de vouchers** con QR único y firma HMAC
- ✅ **Validación y canje** atómico single-use
- ✅ **Modo offline-first** con sincronización automática
- ✅ **PWA** para cafetería (funciona sin conexión)
- ✅ **Reportes CSV** para reconciliación
- ✅ **Detección de conflictos** automática
- ✅ **Auditoría completa** de todas las operaciones
- ✅ **Rate limiting** por dispositivo
- ✅ **Multi-cafetería** con geolocalización

## 🚀 Quick Start

### Prerequisitos

- Node.js 18+
- npm 9+
- SQLite3 (o PostgreSQL)

### Instalación Local

```bash
# Clonar repositorio
git clone https://github.com/hostal/vouchers.git
cd vouchers

# Backend
cd backend
npm install
cp .env.example .env
# Editar .env con tus valores
npm run db:setup
npm run dev

# PWA (en otra terminal)
cd ../pwa-cafeteria
npm install
npm run dev
Acceder a:

Backend: http://localhost:3000
PWA: http://localhost:3001
Con Docker
# Copiar .env.example a .env y configurar
cp backend/.env.example backend/.env

# Iniciar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f
📚 Documentación
Guía de Usuario
API Specification
Arquitectura
Deployment
Troubleshooting
🧪 Testing
# Todos los tests
npm test

# Solo unitarios
npm run test:unit

# Solo integración
npm run test:integration

# Test Case #10 específico
npm run test:case10

# Con cobertura
npm run test -- --coverage
🔐 Seguridad
HMAC-SHA256 para integridad de vouchers
JWT con roles para autenticación
Rate limiting por dispositivo
HTTPS obligatorio en producción
Secrets management con variables de entorno
📊 Arquitectura
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Recepción  │────────▶│   Backend    │◀────────│  Cafetería  │
│    (Web)    │         │  Node.js +   │         │    (PWA)    │
└─────────────┘         │   SQLite     │         └─────────────┘
                        └──────────────┘
                              │
                        [Fly.io / VPS]
                              │
                        ┌──────▼──────┐
                        │   Storage   │
                        │  (Volume)   │
                        └─────────────┘
🌐 Deploy a Producción
Fly.io (Recomendado)
# Instalar Fly CLI
curl -L https://fly.io/install.sh | sh

# Deploy
./scripts/deploy-fly.sh
VPS (Manual)
# Setup
./scripts/setup-production.sh

# Iniciar con PM2
pm2 start ecosystem.config.js
pm2 save
📈 Métricas y Monitoreo
Health checks cada 30s
Logs estructurados en JSON
Métricas de negocio (canjes/día)
Alertas automáticas
Dashboard en tiempo real
🤝 Contribuir
Fork el proyecto
Crear feature branch (git checkout -b feature/AmazingFeature)
Commit cambios (git commit -m 'Add AmazingFeature')
Push al branch (git push origin feature/AmazingFeature)
Abrir Pull Request
📝 Licencia
Propietario - Hostal Playa Norte © 2025

👥 Soporte
Email: soporte@hostalplayanorte.com
Documentación: https://docs.hostalplayanorte.com
Issues: https://github.com/hostal/vouchers/issues
Versión: 3.0.0
Última actualización: 2025-01-20
Estado: ✅ Producción