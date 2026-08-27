#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Source .env if present
if [ -f "${ROOT_DIR}/.env" ]; then
    # shellcheck disable=SC1091
    set -a
    source "${ROOT_DIR}/.env"
    set +a
fi

if [ $# -lt 1 ]; then
    echo "Usage: $0 <path_to_backup_file> [--force]"
    exit 1
fi

BACKUP_FILE="$1"
FORCE="${2:-}"
PASSPHRASE="${BACKUP_PASSPHRASE:-}"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "ERROR: Backup file not found: ${BACKUP_FILE}" >&2
    exit 1
fi

# Verify Checksum if present
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
    echo "--> Verifying SHA256 checksum..."
    (
        cd "$(dirname "${BACKUP_FILE}")"
        if command -v shasum >/dev/null 2>&1; then
            shasum -a 256 -c "$(basename "${CHECKSUM_FILE}")"
        elif command -v sha256sum >/dev/null 2>&1; then
            sha256sum -c "$(basename "${CHECKSUM_FILE}")"
        fi
    )
    echo "--> Checksum verification passed."
fi

if [ "${FORCE}" != "--force" ]; then
    echo "WARNING: This will overwrite existing data in the target database."
    read -r -p "Are you sure you want to proceed with restore? (y/N): " CONFIRM
    if [[ ! "${CONFIRM}" =~ ^[Yy]$ ]]; then
        echo "Restore aborted by user."
        exit 0
    fi
fi

CONTAINER_NAME="syncpad_postgres"
DB_NAME="${POSTGRES_DB:-syncpad_db}"
DB_USER="${POSTGRES_USER:-syncpad_user}"

echo "==> Restoring database from [${BACKUP_FILE}]..."

# Prepare stream: decrypt if encrypted, then gunzip
if [[ "${BACKUP_FILE}" == *.enc ]]; then
    if [ -z "${PASSPHRASE}" ]; then
        echo "ERROR: Encrypted backup detected but BACKUP_PASSPHRASE is not set." >&2
        exit 1
    fi
    echo "--> Decrypting AES-256-CBC backup..."
    if docker ps --filter "name=${CONTAINER_NAME}" --filter "status=running" | grep -q "${CONTAINER_NAME}"; then
        openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -pass "pass:${PASSPHRASE}" -in "${BACKUP_FILE}" \
            | gunzip \
            | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1
    else
        openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -pass "pass:${PASSPHRASE}" -in "${BACKUP_FILE}" \
            | gunzip \
            | psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1
    fi
else
    if docker ps --filter "name=${CONTAINER_NAME}" --filter "status=running" | grep -q "${CONTAINER_NAME}"; then
        gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1
    else
        gunzip -c "${BACKUP_FILE}" | psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1
    fi
fi

echo "--> Verifying restored relations..."
if docker ps --filter "name=${CONTAINER_NAME}" --filter "status=running" | grep -q "${CONTAINER_NAME}"; then
    docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "\dt"
else
    psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER}" -d "${DB_NAME}" -c "\dt"
fi

echo "==> Database restore & verification completed successfully."
