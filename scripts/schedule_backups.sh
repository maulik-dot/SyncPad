#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_SCRIPT="${ROOT_DIR}/scripts/backup_db.sh"

CRON_SCHEDULE="${1:-0 2 * * *}" # Default: 2:00 AM daily

CRON_LINE="${CRON_SCHEDULE} ${BACKUP_SCRIPT} >> ${ROOT_DIR}/backups/backup.log 2>&1"

echo "==> Configuring automated database backup schedule..."
echo "==> Schedule: '${CRON_SCHEDULE}'"
echo "==> Command: ${BACKUP_SCRIPT}"

# Check if cron line is already registered
if crontab -l 2>/dev/null | grep -Fq "${BACKUP_SCRIPT}"; then
    echo "==> Existing backup job detected in crontab. Updating..."
    crontab -l 2>/dev/null | grep -Fv "${BACKUP_SCRIPT}" | { cat; echo "${CRON_LINE}"; } | crontab -
else
    echo "==> Installing new backup job in crontab..."
    (crontab -l 2>/dev/null || true; echo "${CRON_LINE}") | crontab -
fi

echo "==> Cron schedule successfully installed. Current user crontab:"
crontab -l | grep -F "${BACKUP_SCRIPT}"
