#!/bin/bash
set -euo pipefail

echo "============================================================"
echo "           SyncPad Production Deployment Verification       "
echo "============================================================"

PASS_COUNT=0
FAIL_COUNT=0

assert_check() {
    local name="$1"
    local cmd="$2"
    echo -n "==> Checking: ${name}... "
    if eval "${cmd}" >/dev/null 2>&1; then
        echo " [PASS]"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo " [FAIL]"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# 1. Non-root user check
assert_check "Application runs as non-root user (appuser)" \
    "[ \"\$(docker exec syncpad_app whoami 2>/dev/null)\" = 'appuser' ]"

# 2. Database container healthy
assert_check "PostgreSQL container is healthy" \
    "[ \"\$(docker inspect --format='{{.State.Health.Status}}' syncpad_postgres 2>/dev/null)\" = 'healthy' ]"

# 3. RabbitMQ STOMP broker container healthy
assert_check "RabbitMQ STOMP broker container is healthy" \
    "[ \"\$(docker inspect --format='{{.State.Health.Status}}' syncpad_rabbitmq 2>/dev/null)\" = 'healthy' ]"

# 4. Port Isolation: Postgres not exposed to 0.0.0.0 and App only bound to 127.0.0.1
assert_check "PostgreSQL port 5432 is not exposed to 0.0.0.0" \
    "! docker compose ps postgres --format json | grep -q '\"URL\":\"0.0.0.0\"'"
assert_check "Backend App port is isolated to 127.0.0.1" \
    "docker compose ps app --format json | grep -q '127.0.0.1:8083'"

# 5. Direct App Health Endpoint (via localhost)
assert_check "Spring Boot /actuator/health is UP on port 8083" \
    "curl -s http://127.0.0.1:8083/actuator/health | grep -q '\"status\":\"UP\"'"

# 6. Direct App Liveness & Readiness
assert_check "Liveness probe is UP" \
    "curl -s http://127.0.0.1:8083/actuator/health/liveness | grep -q '\"status\":\"UP\"'"
assert_check "Readiness probe is UP" \
    "curl -s http://127.0.0.1:8083/actuator/health/readiness | grep -q '\"status\":\"UP\"'"

# 7. Prometheus Metrics
assert_check "Micrometer Prometheus metrics endpoint is emitting" \
    "curl -s http://127.0.0.1:8083/actuator/prometheus | grep -q 'jvm_memory_used_bytes'"

# 8. HTTP to HTTPS 301 Redirect
assert_check "Port 80 redirects to HTTPS with 301" \
    "curl -s -I http://localhost/actuator/health | grep -q '301 Moved Permanently'"

# 9. HTTPS Reverse Proxy
assert_check "HTTPS reverse proxy terminates TLS and serves UP status" \
    "curl -k -s https://localhost/actuator/health | grep -q '\"status\":\"UP\"'"

# 10. Security Headers on HTTPS
assert_check "Security Header: X-Content-Type-Options is nosniff" \
    "curl -k -s -I https://localhost/actuator/health | grep -qi 'x-content-type-options: nosniff'"
assert_check "Security Header: X-Frame-Options is DENY" \
    "curl -k -s -I https://localhost/actuator/health | grep -qi 'x-frame-options: DENY'"
assert_check "Security Header: Strict-Transport-Security is present" \
    "curl -k -s -I https://localhost/actuator/health | grep -qi 'strict-transport-security'"
assert_check "Security Header: Content-Security-Policy is present" \
    "curl -k -s -I https://localhost/actuator/health | grep -qi 'content-security-policy'"

# 11. Rate Limiting Check
assert_check "Rate limiter triggers HTTP 429 after burst requests" \
    "for i in {1..10}; do curl -k -s -o /dev/null -w '%{http_code}\n' -X POST https://localhost/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"dummy@test.com\",\"password\":\"x\"}'; done | grep -q '429'"

echo "============================================================"
echo " Verification Complete: ${PASS_COUNT} Passed, ${FAIL_COUNT} Failed"
echo "============================================================"

if [ "${FAIL_COUNT}" -gt 0 ]; then
    exit 1
fi
