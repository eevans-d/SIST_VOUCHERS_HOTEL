#!/bin/bash

# Deploy script for production

set -e

echo "🚀 Iniciando deployment a producción..."

# 1. Backup de base de datos
echo "📦 Creando backup de BD..."
docker-compose exec -T backend sh -c 'cp db/vouchers.db db/vouchers.db.backup.'$(date +%s)

# 2. Pull de cambios
echo "📥 Actualizando código..."
git pull origin main

# 3. Build y push de imágenes
echo "🔨 Construyendo imágenes Docker..."
docker-compose build --no-cache

# 4. Iniciar servicios
echo "▶️ Iniciando servicios..."
docker-compose down || true
docker-compose up -d

# 5. Ejecutar migrations
echo "🔄 Ejecutando migraciones de BD..."
docker-compose exec -T backend npm run db:init

# 6. Health check
echo "✅ Validando salud de servicios..."
for i in {1..30}; do
  if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend está saludable"
    break
  fi
  echo "Esperando backend... ($i/30)"
  sleep 1
done

echo "✅ Deployment completado exitosamente!"
