#!/bin/sh
# Wrapper para iniciar la app con trazas y exportar variables clave a logs
set -ex

echo "Starting application..."
echo "PWD: $(pwd)"
echo "NODE_ENV: ${NODE_ENV}"
echo "PORT: ${PORT}"
echo "DATABASE_PATH: ${DATABASE_PATH}"
echo "Node version: $(node -v)"
ls -la

# Ejecutar Node con trazas para capturar errores de inicialización
exec node --trace-uncaught --trace-warnings src/index.js 2>&1
