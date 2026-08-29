#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==> Running SyncPad E2E Browser & API Flow Test Suite..."
export NODE_TLS_REJECT_UNAUTHORIZED=0
node "${ROOT_DIR}/e2e/syncpad-e2e.test.mjs"
