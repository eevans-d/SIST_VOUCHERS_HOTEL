#!/usr/bin/env bash
# Quick validation script for new endpoints after deploy
# Run: ./scripts/validate-deploy.sh

set -e

BASE_URL="https://hpn-vouchers-backend.fly.dev"

echo "==> Validating deployment at $BASE_URL"
echo ""

# Test /live
echo "1. Testing /live (liveness)..."
curl -sf "$BASE_URL/live" | jq -r '.status' || echo "FAIL"

# Test /ready
echo "2. Testing /ready (readiness)..."
curl -sf "$BASE_URL/ready" | jq -r '.database' || echo "FAIL"

# Test /health
echo "3. Testing /health..."
curl -sf "$BASE_URL/health" | jq -r '.database' || echo "FAIL"

# Test /metrics
echo "4. Testing /metrics (Prometheus)..."
curl -sf "$BASE_URL/metrics" | grep -q "db_errors_total" && echo "✓ db_errors_total metric present" || echo "✗ metric missing"

echo ""
echo "==> Validation complete!"
