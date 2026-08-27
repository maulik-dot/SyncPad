#!/usr/bin/env bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==> Initiating SyncPad Performance & Concurrency Load Test..."

if command -v k6 &> /dev/null; then
  echo "Found local k6 binary. Running load-tests/k6-load-test.js..."
  k6 run "${ROOT_DIR}/load-tests/k6-load-test.js"
elif command -v docker &> /dev/null && docker ps &> /dev/null; then
  echo "Executing k6 via Docker container..."
  docker run --rm -i --network="host" grafana/k6 run --insecure-skip-tls-verify - < "${ROOT_DIR}/load-tests/k6-load-test.js" || {
    echo "Docker k6 failed, falling back to concurrent node benchmark..."
    node "${ROOT_DIR}/load-tests/concurrent-benchmark.mjs"
  }
else
  echo "Running Node concurrent benchmark suite (25 concurrent VUs)..."
  node "${ROOT_DIR}/load-tests/concurrent-benchmark.mjs"
fi
