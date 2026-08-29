#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# SyncPad Enterprise Load & Stress Testing Orchestrator (k6)
# Simulates 50-100 concurrent WebSocket collaborative editors & bulk exporters
# ==============================================================================

TARGET_URL="${TARGET_URL:-https://localhost}"
TARGET_WS_URL="${TARGET_WS_URL:-wss://localhost/ws}"
APP_DIRECT_URL="${APP_DIRECT_URL:-http://127.0.0.1:8083}"

echo "============================================================"
echo "    SyncPad High-Concurrency Load & Stress Benchmark       "
echo "    Target: ${TARGET_URL}                                   "
echo "    Workload: 50–100 Concurrent Editors & Bulk Exporters    "
echo "============================================================"

# 1. Register or authenticate benchmark orchestrator user
RAND_SUFFIX="$(date +%s)_$RANDOM"
BENCH_EMAIL="k6_bench_${RAND_SUFFIX}@example.com"
BENCH_PASS="P@ssw0rd123!Load"

echo "--> [1/5] Bootstrapping load test user: ${BENCH_EMAIL}..."
AUTH_RES=$(curl -k -s -X POST "${TARGET_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"k6 Load Runner\", \"email\": \"${BENCH_EMAIL}\", \"password\": \"${BENCH_PASS}\"}")

AUTH_TOKEN=$(echo "${AUTH_RES}" | grep -o '"token":"[^"]*' | cut -d'"' -f4 || true)

if [ -z "${AUTH_TOKEN}" ]; then
  echo "[-] Failed to acquire access token. Response: ${AUTH_RES}"
  exit 1
fi
echo "    [+] Acquired JWT Access Token: ${AUTH_TOKEN:0:16}..."

# 2. Create benchmark workspace
WS_NAME="k6_ws_${RAND_SUFFIX}"
echo "--> [2/5] Creating dedicated benchmark workspace: ${WS_NAME}..."
WS_RES=$(curl -k -s -X POST "${TARGET_URL}/workspaces" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"${WS_NAME}\", \"description\": \"Workspace under high concurrent load\", \"color\": \"#6366f1\"}")

# 3. Create rich test document for bulk export operations
echo "--> [3/5] Seeding rich benchmark document..."
DOC_CONTENT=$(cat << 'EOF'
# Enterprise Performance Benchmark Specification

## 1. Executive Summary
This document serves as the high-throughput workload target for multi-format streaming export stress testing and concurrent WebSocket editing.

## 2. Architecture Overview
- Reverse Proxy: Nginx TLS v1.3 with Strict-Transport-Security and Content-Security-Policy
- Application Core: Spring Boot 4.0.7 / Java 21 LTS running on OpenJ9/HotSpot
- Persistence: PostgreSQL 16.15 with HikariCP Connection Pooling
- Messaging Broker: RabbitMQ 3.13 STOMP Relay on port 61613
- Observability: Prometheus Actuator Metrics & Grafana Dashboards

## 3. Workload Topology
```
[k6 Virtual Users: 100] ---> [Nginx TLS Reverse Proxy]
                                  │
                                  ▼
                         [Spring Boot Cluster]
                             ├── HikariCP Connection Pool (Max: 20)
                             ├── STOMP Message Broker Relay
                             └── Streaming Exporters (MD, HTML, JSON, ZIP)
```

## 4. Key Performance Indicators (KPIs)
| KPI | Target | Threshold |
|---|---|---|
| P95 Export Latency | < 500ms | < 800ms |
| P99 Export Latency | < 1000ms | < 1500ms |
| WebSocket Handshake | < 200ms | < 400ms |
| Failure Rate | < 0.5% | < 2.0% |
| DB Pool Saturation | < 80% | < 90% |
EOF
)

# Escape JSON for curl
ESCAPED_CONTENT=$(echo "${DOC_CONTENT}" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')

DOC_RES=$(curl -k -s -X POST "${TARGET_URL}/documents" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Enterprise Performance Benchmark Document\", \"workspaceName\": \"${WS_NAME}\", \"fileType\": \"DOC\", \"content\": ${ESCAPED_CONTENT}}")

DOC_ID=$(echo "${DOC_RES}" | grep -o '"id":[0-9]*' | head -n1 | cut -d':' -f2 || true)

if [ -z "${DOC_ID}" ]; then
  echo "[-] Failed to create benchmark document. Response: ${DOC_RES}"
  exit 1
fi
echo "    [+] Created Benchmark Document ID: ${DOC_ID}"

# 4. Measure pre-test baseline connection pool & JVM metrics
echo "--> [4/5] Capturing baseline metrics from Prometheus Actuator..."
BASELINE_ACTIVE_CONN=$(curl -k -s "${TARGET_URL}/actuator/metrics/hikaricp.connections.active" | grep -o '"value":[0-9.]*' | cut -d':' -f2 || echo "0")
BASELINE_IDLE_CONN=$(curl -k -s "${TARGET_URL}/actuator/metrics/hikaricp.connections.idle" | grep -o '"value":[0-9.]*' | cut -d':' -f2 || echo "0")
BASELINE_HEAP_BYTES=$(curl -k -s "${TARGET_URL}/actuator/metrics/jvm.memory.used?tag=area:heap" | grep -o '"value":[0-9.]*' | cut -d':' -f2 || echo "0")
BASELINE_HEAP_MB=$(python3 -c "print(round(${BASELINE_HEAP_BYTES:-0} / (1024*1024), 2))")

echo "    [i] Baseline HikariCP Active Connections : ${BASELINE_ACTIVE_CONN}"
echo "    [i] Baseline HikariCP Idle Connections   : ${BASELINE_IDLE_CONN}"
echo "    [i] Baseline JVM Heap Memory Used        : ${BASELINE_HEAP_MB} MB"

# 5. Launch k6 inside Docker container connected to host network
echo "--> [5/5] Launching k6 benchmark container with 50–100 VUs..."
echo "------------------------------------------------------------"

docker run --rm -i \
  --network host \
  -e TARGET_URL="${TARGET_URL}" \
  -e TARGET_WS_URL="${TARGET_WS_URL}" \
  -e AUTH_TOKEN="${AUTH_TOKEN}" \
  -e DOC_ID="${DOC_ID}" \
  grafana/k6 run --insecure-skip-tls-verify - < load-tests/syncpad-k6-stress.js

echo "------------------------------------------------------------"
echo "--> Post-run: Querying peak connection pool & memory saturation..."

POST_ACTIVE_CONN=$(curl -k -s "${TARGET_URL}/actuator/metrics/hikaricp.connections.active" | grep -o '"value":[0-9.]*' | cut -d':' -f2 || echo "0")
POST_IDLE_CONN=$(curl -k -s "${TARGET_URL}/actuator/metrics/hikaricp.connections.idle" | grep -o '"value":[0-9.]*' | cut -d':' -f2 || echo "0")
POST_HEAP_BYTES=$(curl -k -s "${TARGET_URL}/actuator/metrics/jvm.memory.used?tag=area:heap" | grep -o '"value":[0-9.]*' | cut -d':' -f2 || echo "0")
POST_HEAP_MB=$(python3 -c "print(round(${POST_HEAP_BYTES:-0} / (1024*1024), 2))")

echo "    [+] Post-Run HikariCP Active Connections : ${POST_ACTIVE_CONN}"
echo "    [+] Post-Run HikariCP Idle Connections   : ${POST_IDLE_CONN}"
echo "    [+] Post-Run JVM Heap Memory Used        : ${POST_HEAP_MB} MB"

echo "============================================================"
echo "    Load & Stress Test Completed Successfully!              "
echo "============================================================"
