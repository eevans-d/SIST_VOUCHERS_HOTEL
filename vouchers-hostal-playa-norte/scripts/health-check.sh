#!/bin/bash

# Health check script para monitoreo externo

API_URL="${1:-http://localhost:3000}"
TIMEOUT=5

response=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "$API_URL/health")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" -eq 200 ]; then
    echo "✅ API healthy"
    echo "$body" | jq '.'
    exit 0
else
    echo "❌ API unhealthy (HTTP $http_code)"
    echo "$body"
    exit 1
fi
