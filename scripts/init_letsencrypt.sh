#!/usr/bin/env bash
# ==============================================================================
# SyncPad Automated Let's Encrypt / Certbot TLS Setup
# Requests real certificates from Let's Encrypt with zero-downtime Nginx reload.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

DOMAIN="${1:-}"
EMAIL="${2:-}"
STAGING="${3:-0}" # 1 for staging/test, 0 for production

if [ -z "${DOMAIN}" ] || [ -z "${EMAIL}" ]; then
    echo "Usage: $0 <domain.com> <admin@domain.com> [staging: 0|1]"
    exit 1
fi

SSL_DIR="${ROOT_DIR}/nginx/ssl"
mkdir -p "${SSL_DIR}"

echo "==> Preparing TLS certificate bootstrap for '${DOMAIN}'..."

STAGING_ARG=""
if [ "${STAGING}" != "0" ]; then
    echo "==> Using Let's Encrypt staging environment (testing rate limits)..."
    STAGING_ARG="--staging"
fi

if command -v certbot >/dev/null 2>&1; then
    echo "--> Requesting certificates via host certbot..."
    certbot certonly --webroot -w "${ROOT_DIR}/nginx/certbot" \
        ${STAGING_ARG} \
        --email "${EMAIL}" \
        -d "${DOMAIN}" \
        --rsa-key-size 4096 \
        --agree-tos \
        --force-renewal \
        --non-interactive

    echo "--> Copying issued certificates to nginx/ssl..."
    cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "${SSL_DIR}/cert.pem"
    cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" "${SSL_DIR}/key.pem"
    chmod 600 "${SSL_DIR}/key.pem"
    chmod 644 "${SSL_DIR}/cert.pem"

    echo "--> Reloading Nginx configuration..."
    if docker ps --filter "name=syncpad_nginx" --filter "status=running" | grep -q "syncpad_nginx"; then
        docker exec syncpad_nginx nginx -s reload
    fi
    echo "==> Production TLS certificates installed successfully for '${DOMAIN}'."
else
    echo "--> certbot not installed locally. Run this command on your production server:"
    echo "    sudo certbot certonly --standalone -d ${DOMAIN} --email ${EMAIL} --agree-tos"
fi
