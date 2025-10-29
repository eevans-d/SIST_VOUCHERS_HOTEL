#!/bin/sh
# Wrapper para iniciar la app con trazas y exportar variables clave a logs
set -e

echo "Starting application..."
echo "NODE_ENV: ${NODE_ENV}"
echo "PORT: ${PORT}"
echo "DATABASE_PATH: ${DATABASE_PATH}"

# Ejecutar Node con trazas para capturar errores de inicialización
exec node --trace-uncaught --trace-warnings src/index.js 2>&1
