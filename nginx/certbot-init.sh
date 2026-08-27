#!/bin/bash
set -euo pipefail

# Automated Let's Encrypt / Certbot initialization script
# Usage: ./nginx/certbot-init.sh <domain_name> <email_address>

if [ $# -lt 2 ]; then
    echo "Usage: $0 <domain_name> <email_address>"
    echo "Example: $0 syncpad.example.com admin@example.com"
    exit 1
fi

DOMAIN="$1"
EMAIL="$2"
STAGING="${STAGING:-0}" # Set to 1 to test against Let's Encrypt staging environment

echo "==> Requesting Let's Encrypt SSL certificate for ${DOMAIN} (${EMAIL})..."

STAGING_ARG=""
if [ "${STAGING}" != "0" ]; then
    STAGING_ARG="--staging"
fi

# Run certbot via docker container
docker run -it --rm --name certbot \
    -v "$(pwd)/nginx/ssl:/etc/letsencrypt" \
    -v "$(pwd)/nginx/certbot-challenge:/var/www/certbot" \
    -p 80:80 \
    certbot/certbot certonly --standalone \
    -d "${DOMAIN}" \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    ${STAGING_ARG}

# Link generated certificates to nginx expected paths
cp "$(pwd)/nginx/ssl/live/${DOMAIN}/fullchain.pem" "$(pwd)/nginx/ssl/fullchain.pem"
cp "$(pwd)/nginx/ssl/live/${DOMAIN}/privkey.pem" "$(pwd)/nginx/ssl/privkey.pem"

echo "==> Certificate successfully retrieved and linked to nginx/ssl/fullchain.pem and privkey.pem."
echo "==> Restarting Nginx container to load new certificates..."
docker compose restart nginx
