#!/bin/bash

# Script de monitoreo continuo

API_URL="${1:-http://localhost:3000}"
INTERVAL="${2:-30}"

echo "🔍 Monitoreando $API_URL cada ${INTERVAL}s"
echo "Presiona Ctrl+C para detener"
echo ""

while true; do
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    if curl -sf "$API_URL/health" > /dev/null; then
        echo "[$timestamp] ✅ OK"
    else
        echo "[$timestamp] ❌ FAIL"
        # Enviar alerta (ejemplo con webhook)
        # curl -X POST https://hooks.slack.com/... -d "..."
    fi
    
    sleep $INTERVAL
done