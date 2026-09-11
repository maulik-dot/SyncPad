#!/usr/bin/env bash
# ==============================================================================
# SyncPad Automated Production Deployment Script
# Usage: ./scripts/deploy.sh [domain] [email]
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "============================================================"
echo "           SyncPad Production Deployment Initializer        "
echo "============================================================"

DOMAIN="${1:-${DOMAIN:-}}"
EMAIL="${2:-${EMAIL:-}}"

if [ -z "${DOMAIN}" ]; then
    echo -n "Enter your production domain (e.g. syncpad.yourdomain.com or localhost): "
    read -r DOMAIN
fi

DOMAIN="${DOMAIN:-syncpad.yourdomain.com}"

echo "==> Configuring for domain: ${DOMAIN}"

# 1. Update .env if ALLOWED_ORIGINS does not match
if [ -f "${ROOT_DIR}/.env" ]; then
    if ! grep -q "${DOMAIN}" "${ROOT_DIR}/.env"; then
        echo "--> Updating ALLOWED_ORIGINS in .env to include ${DOMAIN}..."
        sed -i.bak "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=https://${DOMAIN},https://localhost,http://localhost:3000,http://localhost:5173,http://localhost:8082,http://localhost:8083|" "${ROOT_DIR}/.env"
        rm -f "${ROOT_DIR}/.env.bak"
    fi
else
    echo "--> .env not found, copying from .env.example..."
    cp "${ROOT_DIR}/.env.example" "${ROOT_DIR}/.env"
fi

# 2. Update Nginx server_name if needed
if [ "${DOMAIN}" != "localhost" ]; then
    echo "--> Updating Nginx server_name to ${DOMAIN}..."
    sed -i.bak "s|server_name .*;|server_name ${DOMAIN} localhost;|g" "${ROOT_DIR}/nginx/nginx.conf"
    rm -f "${ROOT_DIR}/nginx/nginx.conf.bak"
fi

# 3. Ensure baseline SSL certificates exist so Nginx starts
if [ ! -f "${ROOT_DIR}/nginx/ssl/server.crt" ] || [ ! -f "${ROOT_DIR}/nginx/ssl/server.key" ]; then
    echo "--> Generating initial self-signed certificates..."
    "${SCRIPT_DIR}/generate_ssl_certs.sh" "${DOMAIN}"
fi

# 4. Build and spin up containers
echo "==> Building and launching Docker Compose stack..."
cd "${ROOT_DIR}"
docker compose up -d --build

# 5. Wait for Spring Boot to be healthy
echo "==> Waiting for SyncPad backend services to report healthy..."
ATTEMPTS=0
MAX_ATTEMPTS=30
while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
    if curl -s http://127.0.0.1:8083/actuator/health | grep -q '"status":"UP"'; then
        echo "--> SyncPad backend is UP and HEALTHY!"
        break
    fi
    ATTEMPTS=$((ATTEMPTS + 1))
    echo "    Waiting for application startup (attempt ${ATTEMPTS}/${MAX_ATTEMPTS})..."
    sleep 3
done

if [ $ATTEMPTS -eq $MAX_ATTEMPTS ]; then
    echo "[WARNING] Application startup is taking longer than expected. Check logs with: docker compose logs app"
fi

# 6. Request Let's Encrypt SSL if real domain and email provided
if [ "${DOMAIN}" != "localhost" ] && [ -n "${EMAIL}" ]; then
    echo "==> Requesting Let's Encrypt SSL certificates for ${DOMAIN}..."
    "${SCRIPT_DIR}/init_letsencrypt.sh" "${DOMAIN}" "${EMAIL}" 0 || {
        echo "[WARNING] Let's Encrypt automated challenge failed. Make sure your DNS A record points to this server's public IP."
    }
fi

# 7. Run deployment verification
echo "==> Running automated verification..."
"${SCRIPT_DIR}/verify_deployment.sh" || {
    echo "[WARNING] Some deployment verification checks failed. Check container logs with: docker compose logs"
}

echo "============================================================"
echo " Deployment process complete!"
echo " Access your application at: https://${DOMAIN}"
echo "============================================================"
