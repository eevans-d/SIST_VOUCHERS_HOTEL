#!/bin/bash

# 📊 Monitor - Backend en Producción
# Monitoreo continuo del backend con métricas en tiempo real

set -e

BACKEND_URL="${BACKEND_URL:-https://hpn-vouchers-backend.fly.dev}"
REFRESH_INTERVAL="${REFRESH_INTERVAL:-5}"  # segundos

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

clear

echo -e "${BOLD}${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║      Backend Production Monitor - Hostal Playa Norte      ║${NC}"
echo -e "${BOLD}${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Backend: ${CYAN}$BACKEND_URL${NC}"
echo -e "Refresh: Every ${REFRESH_INTERVAL}s (Press Ctrl+C to stop)"
echo ""

get_status_color() {
  local status="$1"
  if [[ "$status" == "ok" || "$status" == "live" || "$status" == "ready" ]]; then
    echo "$GREEN"
  elif [[ "$status" == "degraded" ]]; then
    echo "$YELLOW"
  else
    echo "$RED"
  fi
}

format_uptime() {
  local seconds=$1
  local days=$((seconds / 86400))
  local hours=$(((seconds % 86400) / 3600))
  local mins=$(((seconds % 3600) / 60))
  local secs=$((seconds % 60))

  if [ $days -gt 0 ]; then
    echo "${days}d ${hours}h ${mins}m"
  elif [ $hours -gt 0 ]; then
    echo "${hours}h ${mins}m ${secs}s"
  elif [ $mins -gt 0 ]; then
    echo "${mins}m ${secs}s"
  else
    echo "${secs}s"
  fi
}

while true; do
  # Limpiar pantalla (mantener header)
  tput cup 5 0
  tput ed

  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${BOLD}Last update: ${TIMESTAMP}${NC}"
  echo ""

  # ============================================================
  # Health Check
  # ============================================================
  echo -e "${BOLD}${CYAN}┌─ Health Status${NC}"
  HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/health" 2>/dev/null || echo -e "\n000")
  HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)
  HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | tail -n 1)

  if [ "$HEALTH_CODE" = "200" ]; then
    STATUS=$(echo "$HEALTH_BODY" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
    UPTIME=$(echo "$HEALTH_BODY" | jq -r '.uptime_seconds // 0' 2>/dev/null || echo "0")
    VERSION=$(echo "$HEALTH_BODY" | jq -r '.version // "unknown"' 2>/dev/null || echo "unknown")
    DB_STATUS=$(echo "$HEALTH_BODY" | jq -r '.database // "unknown"' 2>/dev/null || echo "unknown")

    STATUS_COLOR=$(get_status_color "$STATUS")
    echo -e "│ Status:    ${STATUS_COLOR}${STATUS}${NC}"
    echo -e "│ Version:   ${VERSION}"
    echo -e "│ Uptime:    $(format_uptime $UPTIME)"
    echo -e "│ Database:  $(get_status_color "$DB_STATUS")${DB_STATUS}${NC}"
  else
    echo -e "│ ${RED}✗ Health check failed (HTTP $HEALTH_CODE)${NC}"
  fi
  echo -e "${CYAN}└─${NC}"
  echo ""

  # ============================================================
  # Liveness & Readiness
  # ============================================================
  echo -e "${BOLD}${CYAN}┌─ Probes${NC}"

  # Liveness
  LIVE_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/live" 2>/dev/null || echo "000")
  if [ "$LIVE_CODE" = "200" ]; then
    echo -e "│ Liveness:  ${GREEN}✓ OK${NC} (200)"
  else
    echo -e "│ Liveness:  ${RED}✗ FAIL${NC} ($LIVE_CODE)"
  fi

  # Readiness
  READY_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/ready" 2>/dev/null || echo "000")
  if [ "$READY_CODE" = "200" ]; then
    echo -e "│ Readiness: ${GREEN}✓ OK${NC} (200)"
  else
    echo -e "│ Readiness: ${RED}✗ FAIL${NC} ($READY_CODE)"
  fi

  echo -e "${CYAN}└─${NC}"
  echo ""

  # ============================================================
  # Metrics
  # ============================================================
  echo -e "${BOLD}${CYAN}┌─ Prometheus Metrics${NC}"

  METRICS=$(curl -s "$BACKEND_URL/metrics" 2>/dev/null || echo "")

  if [ -n "$METRICS" ]; then
    # HTTP Requests Total
    HTTP_TOTAL=$(echo "$METRICS" | grep '^http_requests_total{' | awk '{sum+=$2} END {print sum}' || echo "0")
    echo -e "│ HTTP Requests:      ${HTTP_TOTAL}"

    # HTTP Errors (5xx)
    HTTP_ERRORS=$(echo "$METRICS" | grep '^http_server_errors_total{' | awk '{sum+=$2} END {print sum}' || echo "0")
    if [ "$HTTP_ERRORS" -gt 0 ]; then
      echo -e "│ HTTP 5xx Errors:    ${RED}${HTTP_ERRORS}${NC}"
    else
      echo -e "│ HTTP 5xx Errors:    ${GREEN}${HTTP_ERRORS}${NC}"
    fi

    # DB Errors
    DB_ERRORS=$(echo "$METRICS" | grep '^db_errors_total{' | awk '{sum+=$2} END {print sum}' || echo "0")
    if [ "$DB_ERRORS" -gt 0 ]; then
      echo -e "│ DB Errors:          ${RED}${DB_ERRORS}${NC}"
    else
      echo -e "│ DB Errors:          ${GREEN}${DB_ERRORS}${NC}"
    fi

    # Memory (heap)
    HEAP_USED=$(echo "$METRICS" | grep '^nodejs_heap_size_used_bytes' | grep -v '#' | awk '{print $2}' | head -1)
    HEAP_TOTAL=$(echo "$METRICS" | grep '^nodejs_heap_size_total_bytes' | grep -v '#' | awk '{print $2}' | head -1)

    if [ -n "$HEAP_USED" ] && [ -n "$HEAP_TOTAL" ]; then
      HEAP_USED_MB=$(echo "scale=1; $HEAP_USED / 1048576" | bc)
      HEAP_TOTAL_MB=$(echo "scale=1; $HEAP_TOTAL / 1048576" | bc)
      HEAP_PERCENT=$(echo "scale=1; ($HEAP_USED / $HEAP_TOTAL) * 100" | bc)

      if (( $(echo "$HEAP_PERCENT > 80" | bc -l) )); then
        echo -e "│ Memory (heap):      ${RED}${HEAP_USED_MB}MB / ${HEAP_TOTAL_MB}MB (${HEAP_PERCENT}%)${NC}"
      elif (( $(echo "$HEAP_PERCENT > 60" | bc -l) )); then
        echo -e "│ Memory (heap):      ${YELLOW}${HEAP_USED_MB}MB / ${HEAP_TOTAL_MB}MB (${HEAP_PERCENT}%)${NC}"
      else
        echo -e "│ Memory (heap):      ${GREEN}${HEAP_USED_MB}MB / ${HEAP_TOTAL_MB}MB (${HEAP_PERCENT}%)${NC}"
      fi
    fi

    # Process uptime (from metrics)
    PROCESS_UPTIME=$(echo "$METRICS" | grep '^process_uptime_seconds' | grep -v '#' | awk '{print $2}')
    if [ -n "$PROCESS_UPTIME" ]; then
      echo -e "│ Process Uptime:     $(format_uptime ${PROCESS_UPTIME%.*})"
    fi
  else
    echo -e "│ ${YELLOW}⚠ Metrics not available${NC}"
  fi

  echo -e "${CYAN}└─${NC}"
  echo ""

  # ============================================================
  # Response Times
  # ============================================================
  echo -e "${BOLD}${CYAN}┌─ Response Times${NC}"

  # Health endpoint
  HEALTH_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BACKEND_URL/health" 2>/dev/null || echo "0")
  HEALTH_TIME_MS=$(echo "$HEALTH_TIME * 1000" | bc | awk '{printf "%.0f", $1}')

  if [ "$HEALTH_TIME_MS" -lt 100 ]; then
    echo -e "│ /health:   ${GREEN}${HEALTH_TIME_MS}ms${NC}"
  elif [ "$HEALTH_TIME_MS" -lt 500 ]; then
    echo -e "│ /health:   ${YELLOW}${HEALTH_TIME_MS}ms${NC}"
  else
    echo -e "│ /health:   ${RED}${HEALTH_TIME_MS}ms${NC}"
  fi

  # Metrics endpoint
  METRICS_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BACKEND_URL/metrics" 2>/dev/null || echo "0")
  METRICS_TIME_MS=$(echo "$METRICS_TIME * 1000" | bc | awk '{printf "%.0f", $1}')

  if [ "$METRICS_TIME_MS" -lt 200 ]; then
    echo -e "│ /metrics:  ${GREEN}${METRICS_TIME_MS}ms${NC}"
  elif [ "$METRICS_TIME_MS" -lt 1000 ]; then
    echo -e "│ /metrics:  ${YELLOW}${METRICS_TIME_MS}ms${NC}"
  else
    echo -e "│ /metrics:  ${RED}${METRICS_TIME_MS}ms${NC}"
  fi

  echo -e "${CYAN}└─${NC}"
  echo ""

  # ============================================================
  # Quick Actions
  # ============================================================
  echo -e "${BOLD}${BLUE}Quick Commands:${NC}"
  echo -e "  ${CYAN}flyctl logs -a hpn-vouchers-backend${NC}     # View logs"
  echo -e "  ${CYAN}flyctl status -a hpn-vouchers-backend${NC}   # App status"
  echo -e "  ${CYAN}flyctl apps restart hpn-vouchers-backend${NC} # Restart app"
  echo ""

  # Wait before next refresh
  sleep $REFRESH_INTERVAL
done
