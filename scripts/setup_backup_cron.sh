#!/usr/bin/env bash
# ==============================================================================
# SyncPad Production Automated Backup Cron Setup
# Configures a daily recurring backup job (AES-256 encrypted + SHA256 checksum)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_SCRIPT="${ROOT_DIR}/scripts/backup_db.sh"
LOG_FILE="${ROOT_DIR}/backups/cron_backup.log"

# Default to 02:00 UTC daily
CRON_SCHEDULE="${CRON_SCHEDULE:-0 2 * * *}"

if [ ! -f "${BACKUP_SCRIPT}" ]; then
    echo "ERROR: Backup script not found at ${BACKUP_SCRIPT}" >&2
    exit 1
fi

chmod +x "${BACKUP_SCRIPT}"
mkdir -p "${ROOT_DIR}/backups"

CRON_CMD="${CRON_SCHEDULE} /bin/bash ${BACKUP_SCRIPT} >> ${LOG_FILE} 2>&1 # syncpad_db_backup"

if [ "${1:-}" = "--dry-run" ]; then
    echo "==> [Dry-Run] Crontab entry to be configured:"
    echo "    ${CRON_CMD}"
    exit 0
fi

echo "==> Configuring SyncPad automated backup cron job..."

# Read existing crontab, filter out old syncpad backup entries, and append new job
CURRENT_CRON=$(crontab -l 2>/dev/null | grep -v "syncpad_db_backup" || true)

if [ -n "${CURRENT_CRON}" ]; then
    printf "%s\n%s\n" "${CURRENT_CRON}" "${CRON_CMD}" | crontab -
else
    printf "%s\n" "${CRON_CMD}" | crontab -
fi

echo "==> Crontab updated successfully. Active syncpad backup schedule:"
crontab -l | grep "syncpad_db_backup"
