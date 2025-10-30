#!/bin/bash

# 🧪 Integration Test - Sistema Completo
# Valida el flujo completo: Frontend → Backend → DB

set -e

BACKEND_URL="https://hpn-vouchers-backend.fly.dev/api"
FRONTEND_URL="https://hpn-vouchers-frontend.fly.dev"

echo "🧪 Integration test del sistema completo..."
echo "Backend: $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
  local test_name="$1"
  local test_command="$2"

  echo -n "  Testing: $test_name... "

  if eval "$test_command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((TESTS_PASSED++))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC}"
    ((TESTS_FAILED++))
    return 1
  fi
}

# ============================================================
# Backend Tests
# ============================================================

echo "📡 Backend Tests"
echo "================="

run_test "Backend /health" \
  "curl -f -s '$BACKEND_URL/health' | grep -q '\"status\":\"ok\"'"

run_test "Backend /live" \
  "curl -f -s '$BACKEND_URL/live' | grep -q '\"status\":\"ok\"'"

run_test "Backend /ready" \
  "curl -f -s '$BACKEND_URL/ready' | grep -q '\"status\"'"

run_test "Backend /metrics" \
  "curl -f -s '$BACKEND_URL/metrics' | grep -q 'http_requests_total'"

run_test "Backend db_errors_total metric" \
  "curl -f -s '$BACKEND_URL/metrics' | grep -q 'db_errors_total'"

echo ""

# ============================================================
# Frontend Tests
# ============================================================

echo "🌐 Frontend Tests"
echo "================="

run_test "Frontend responds 200" \
  "curl -f -s -o /dev/null -w '%{http_code}' '$FRONTEND_URL' | grep -q '200'"

run_test "Frontend has JS assets" \
  "curl -s '$FRONTEND_URL' | grep -q 'src=.*\.js'"

run_test "Frontend has CSS" \
  "curl -s '$FRONTEND_URL' | grep -qE '(href=.*\.css|<style)'"

run_test "Frontend SSL/TLS" \
  "curl -s --head '$FRONTEND_URL' | grep -qE '(HTTP/2 200|HTTP/1.1 200)'"

echo ""

# ============================================================
# CORS Tests
# ============================================================

echo "🔐 CORS Tests"
echo "============="

CORS_RESPONSE=$(curl -s -I \
  -H "Origin: $FRONTEND_URL" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS \
  "$BACKEND_URL/auth/login" 2>/dev/null || echo "")

if echo "$CORS_RESPONSE" | grep -qi "Access-Control-Allow-Origin"; then
  echo -e "  Testing: Backend accepts CORS from frontend... ${GREEN}✓ PASS${NC}"
  ((TESTS_PASSED++))
else
  echo -e "  Testing: Backend accepts CORS from frontend... ${RED}✗ FAIL${NC}"
  echo -e "  ${YELLOW}Action required: Update CORS_ORIGIN in backend${NC}"
  ((TESTS_FAILED++))
fi

echo ""

# ============================================================
# Authentication Flow Test (requires credentials)
# ============================================================

echo "🔑 Authentication Flow"
echo "======================"

# Nota: Este test requiere credenciales válidas
# Descomenta y configura si tienes credenciales de prueba

# TEST_EMAIL="test@hotel.com"
# TEST_PASSWORD="test123"
#
# LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/auth/login" \
#   -H "Content-Type: application/json" \
#   -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
#
# if echo "$LOGIN_RESPONSE" | grep -q "token"; then
#   echo -e "  Testing: Login successful... ${GREEN}✓ PASS${NC}"
#   ((TESTS_PASSED++))
#
#   # Extract token
#   TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
#
#   # Test authenticated endpoint
#   AUTH_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND_URL/vouchers")
#   if [ $? -eq 0 ]; then
#     echo -e "  Testing: Authenticated request... ${GREEN}✓ PASS${NC}"
#     ((TESTS_PASSED++))
#   else
#     echo -e "  Testing: Authenticated request... ${RED}✗ FAIL${NC}"
#     ((TESTS_FAILED++))
#   fi
# else
#   echo -e "  Testing: Login... ${YELLOW}⊘ SKIPPED (no credentials)${NC}"
# fi

echo -e "  ${YELLOW}⊘ SKIPPED (requires test credentials)${NC}"

echo ""

# ============================================================
# Performance Tests
# ============================================================

echo "⚡ Performance Tests"
echo "===================="

# Backend response time
BACKEND_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BACKEND_URL/health")
BACKEND_TIME_MS=$(echo "$BACKEND_TIME * 1000" | bc)

if (( $(echo "$BACKEND_TIME < 0.5" | bc -l) )); then
  echo -e "  Backend response time: ${BACKEND_TIME_MS}ms ${GREEN}✓ PASS${NC}"
  ((TESTS_PASSED++))
else
  echo -e "  Backend response time: ${BACKEND_TIME_MS}ms ${YELLOW}⚠ SLOW${NC}"
fi

# Frontend response time
FRONTEND_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$FRONTEND_URL")
FRONTEND_TIME_MS=$(echo "$FRONTEND_TIME * 1000" | bc)

if (( $(echo "$FRONTEND_TIME < 1.0" | bc -l) )); then
  echo -e "  Frontend response time: ${FRONTEND_TIME_MS}ms ${GREEN}✓ PASS${NC}"
  ((TESTS_PASSED++))
else
  echo -e "  Frontend response time: ${FRONTEND_TIME_MS}ms ${YELLOW}⚠ SLOW${NC}"
fi

echo ""

# ============================================================
# Results
# ============================================================

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
SUCCESS_RATE=$(echo "scale=1; $TESTS_PASSED * 100 / $TOTAL_TESTS" | bc)

echo "════════════════════════════════════════"
echo "Results"
echo "════════════════════════════════════════"
echo -e "Total tests:   $TOTAL_TESTS"
echo -e "Passed:        ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed:        ${RED}$TESTS_FAILED${NC}"
echo -e "Success rate:  ${SUCCESS_RATE}%"
echo "════════════════════════════════════════"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✅ All tests passed!${NC}\n"
  exit 0
else
  echo -e "\n${RED}❌ Some tests failed${NC}\n"
  echo "Troubleshooting:"
  echo "  - Check logs: flyctl logs -a hpn-vouchers-backend"
  echo "  - Check logs: flyctl logs -a hpn-vouchers-frontend"
  echo "  - Verify CORS: Check CORS_ORIGIN secret in backend"
  echo "  - Verify DNS: Check that domains resolve correctly"
  echo ""
  exit 1
fi
