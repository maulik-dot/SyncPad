#!/usr/bin/env bash
# ==============================================================================
# SyncPad Automated PostgreSQL Backup Script
# Creates timestamped, gzip-compressed database dumps with SHA256 verification.
# ==============================================================================

set -euo pipefail

# Source .env if present
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
if [ -f "${ROOT_DIR}/.env" ]; then
    # shellcheck disable=SC1091
    set -a
    source "${ROOT_DIR}/.env"
    set +a
fi

BACKUP_DIR="${ROOT_DIR}/${BACKUP_DIR:-backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RAW_BACKUP_FILE="${BACKUP_DIR}/syncpad_backup_${TIMESTAMP}.sql.gz"
TARGET_FILE="${RAW_BACKUP_FILE}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
PASSPHRASE="${BACKUP_PASSPHRASE:-}"

DB_CONTAINER="${DB_CONTAINER:-syncpad_postgres}"
DB_NAME="${POSTGRES_DB:-syncpad_db}"
DB_USER="${POSTGRES_USER:-syncpad_user}"

mkdir -p "${BACKUP_DIR}"

echo "==> Starting SyncPad Database Backup [${TIMESTAMP}]..."

if docker ps --filter "name=${DB_CONTAINER}" --filter "status=running" | grep -q "${DB_CONTAINER}"; then
    echo "--> Backing up via running Docker container [${DB_CONTAINER}]..."
    docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists | gzip > "${RAW_BACKUP_FILE}"
else
    echo "--> Docker container not running; attempting local pg_dump..."
    pg_dump -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists | gzip > "${RAW_BACKUP_FILE}"
fi

# Verify backup size
RAW_SIZE=$(wc -c < "${RAW_BACKUP_FILE}" | tr -d ' ')
if [ "${RAW_SIZE}" -le 50 ]; then
    echo "ERROR: Backup file is abnormally small (${RAW_SIZE} bytes). Backup failed." >&2
    exit 1
fi

# Encrypt if BACKUP_PASSPHRASE is provided
if [ -n "${PASSPHRASE}" ]; then
    echo "--> Encrypting backup with AES-256-CBC (PBKDF2)..."
    ENC_FILE="${RAW_BACKUP_FILE}.enc"
    openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 -pass "pass:${PASSPHRASE}" \
        -in "${RAW_BACKUP_FILE}" -out "${ENC_FILE}"
    rm -f "${RAW_BACKUP_FILE}"
    TARGET_FILE="${ENC_FILE}"
fi

# Generate SHA256 checksum
(
    cd "${BACKUP_DIR}"
    FILENAME=$(basename "${TARGET_FILE}")
    if command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "${FILENAME}" > "${FILENAME}.sha256"
    elif command -v sha256sum >/dev/null 2>&1; then
        sha256sum "${FILENAME}" > "${FILENAME}.sha256"
    fi
)
echo "--> Backup successfully created: ${TARGET_FILE} ($(du -h "${TARGET_FILE}" | cut -f1))"
echo "--> Checksum recorded: $(cat "${TARGET_FILE}.sha256")"

# Off-Host Storage Upload (AWS S3)
if [ -n "${S3_BUCKET:-}" ]; then
    echo "--> Uploading backup to AWS S3: ${S3_BUCKET}..."
    if command -v aws >/dev/null 2>&1; then
        aws s3 cp "${TARGET_FILE}" "${S3_BUCKET}/"
        aws s3 cp "${TARGET_FILE}.sha256" "${S3_BUCKET}/"
        echo "--> S3 upload completed."
    fi
fi

# Off-Host Storage Upload (Google Cloud Storage)
if [ -n "${GCS_BUCKET:-}" ]; then
    echo "--> Uploading backup to GCS: ${GCS_BUCKET}..."
    if command -v gcloud >/dev/null 2>&1; then
        gcloud storage cp "${TARGET_FILE}"* "${GCS_BUCKET}/"
        echo "--> GCS upload completed."
    fi
fi

# Webhook Notification
if [ -n "${BACKUP_NOTIFICATION_WEBHOOK:-}" ]; then
    curl -s -X POST -H "Content-Type: application/json" \
        -d "{\"status\":\"success\",\"database\":\"${DB_NAME}\",\"file\":\"$(basename "${TARGET_FILE}")\"}" \
        "${BACKUP_NOTIFICATION_WEBHOOK}" || true
fi

# Retention cleanup
echo "--> Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "syncpad_backup_*.sql.gz*" -mtime "+${RETENTION_DAYS}" -delete || true

echo "==> SyncPad Database Backup Completed Successfully."

