#!/usr/bin/env bash
# Smoke check simple para backend vouchers
# Uso: BASE_URL=https://hpn-vouchers-backend.fly.dev ./scripts/smoke-check.sh
#      ./scripts/smoke-check.sh http://localhost:3000

set -euo pipefail

BASE_URL=${1:-${BASE_URL:-http://localhost:3000}}

cyan() { echo -e "\033[36m$1\033[0m"; }
green() { echo -e "\033[32m$1\033[0m"; }
red() { echo -e "\033[31m$1\033[0m"; }

check_endpoint() {
  local path="$1"
  local expected_code="${2:-200}"
  local url="${BASE_URL}${path}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url") || code=000
  if [[ "$code" == "$expected_code" ]]; then
    green "[OK] $path -> $code"
    return 0
  else
    red   "[FAIL] $path -> $code (expected $expected_code)"
    return 1
  fi
}

cyan "==> Smoke check ${BASE_URL}"

ok=true
check_endpoint /live 200 || ok=false
check_endpoint /health 200 || ok=false
check_endpoint /ready 200 || ok=false
check_endpoint /metrics 200 || ok=false

if [[ "$ok" == true ]]; then
  green "✅ Smoke check PASS"
  exit 0
else
  red "❌ Smoke check FAIL"
  exit 1
fi
