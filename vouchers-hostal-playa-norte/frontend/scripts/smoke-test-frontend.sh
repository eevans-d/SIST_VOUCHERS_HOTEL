#!/bin/bash

# 📋 Smoke Test - Frontend Production
# Valida que el frontend desplegado esté funcionando correctamente

set -e

FRONTEND_URL="https://hpn-vouchers-frontend.fly.dev"
BACKEND_URL="https://hpn-vouchers-backend.fly.dev/api"

echo "🔍 Smoke test del frontend en producción..."
echo "Frontend: $FRONTEND_URL"
echo "Backend: $BACKEND_URL"
echo ""

# Test 1: Frontend carga (index.html)
echo "✅ Test 1: Frontend index..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ FAIL: Frontend no responde 200 (código: $HTTP_CODE)"
  exit 1
fi
echo "   ✓ Frontend responde 200 OK"

# Test 2: Health check (si existe)
echo "✅ Test 2: Health check..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/health" || echo "404")
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✓ Health check OK"
elif [ "$HTTP_CODE" = "404" ]; then
  echo "   ⚠ Health check no configurado (404) - OK si es esperado"
else
  echo "   ⚠ Health check responde $HTTP_CODE"
fi

# Test 3: Assets JavaScript
echo "✅ Test 3: Assets JavaScript..."
ASSETS=$(curl -s "$FRONTEND_URL" | grep -o 'src="[^"]*\.js"' | head -1 || echo "")
if [ -n "$ASSETS" ]; then
  echo "   ✓ Assets JS encontrados en HTML"
else
  echo "   ⚠ No se encontraron assets JS en el HTML"
fi

# Test 4: Backend accesible desde frontend (CORS)
echo "✅ Test 4: Backend CORS..."
CORS_HEADER=$(curl -s -H "Origin: $FRONTEND_URL" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS "$BACKEND_URL/auth/login" \
  -o /dev/null -w "%{http_code}" || echo "000")

if [ "$CORS_HEADER" = "204" ] || [ "$CORS_HEADER" = "200" ]; then
  echo "   ✓ Backend acepta CORS del frontend"
else
  echo "   ❌ FAIL: Backend no acepta CORS (código: $CORS_HEADER)"
  echo "   Ejecutar: flyctl secrets set CORS_ORIGIN=\"...,${FRONTEND_URL}\" -a hpn-vouchers-backend"
  exit 1
fi

# Test 5: Backend health
echo "✅ Test 5: Backend health..."
BACKEND_HEALTH=$(curl -s "$BACKEND_URL/health" | grep -o '"status":"ok"' || echo "")
if [ -n "$BACKEND_HEALTH" ]; then
  echo "   ✓ Backend está healthy"
else
  echo "   ❌ FAIL: Backend no está healthy"
  exit 1
fi

# Test 6: Response time
echo "✅ Test 6: Response time..."
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$FRONTEND_URL")
echo "   ✓ Response time: ${RESPONSE_TIME}s"

# Test 7: SSL certificate
echo "✅ Test 7: SSL certificate..."
SSL_CHECK=$(curl -s --head "$FRONTEND_URL" | grep -i "HTTP/2 200" || echo "")
if [ -n "$SSL_CHECK" ]; then
  echo "   ✓ SSL/TLS OK (HTTP/2)"
else
  HTTP1_CHECK=$(curl -s --head "$FRONTEND_URL" | grep -i "HTTP/1.1 200" || echo "")
  if [ -n "$HTTP1_CHECK" ]; then
    echo "   ✓ SSL/TLS OK (HTTP/1.1)"
  else
    echo "   ⚠ No se pudo verificar SSL"
  fi
fi

echo ""
echo "✅ Todos los tests críticos pasaron"
echo ""
echo "🎯 Próximos pasos:"
echo "   1. Abrir $FRONTEND_URL en el browser"
echo "   2. Probar login con credenciales válidas"
echo "   3. Verificar que no haya errores de CORS en la consola"
echo "   4. Navegar por todas las secciones de la app"
echo ""
echo "📊 Monitoreo:"
echo "   flyctl logs -a hpn-vouchers-frontend"
echo "   flyctl status -a hpn-vouchers-frontend"
