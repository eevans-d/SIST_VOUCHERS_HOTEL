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

node --trace-uncaught --trace-warnings src/index.js 2>&1
code=$?
echo "Node exited with code: $code"
if [ "$code" -ne 0 ]; then
	echo "Keeping container alive for debug for 1h..."
	sleep 3600
fi
exit "$code"
