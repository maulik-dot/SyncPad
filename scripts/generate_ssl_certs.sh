#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SSL_DIR="${ROOT_DIR}/nginx/ssl"

mkdir -p "${SSL_DIR}"

DOMAIN="${1:-localhost}"

echo "==> Generating self-signed TLS certificates for domain: ${DOMAIN}..."

# Generate private key and certificate with SAN extension
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "${SSL_DIR}/privkey.pem" \
    -out "${SSL_DIR}/fullchain.pem" \
    -subj "/C=US/ST=State/L=City/O=SyncPad/OU=Production/CN=${DOMAIN}" \
    -addext "subjectAltName=DNS:${DOMAIN},DNS:localhost,IP:127.0.0.1"

# Also symlink server.crt and server.key for backward compatibility
cp "${SSL_DIR}/fullchain.pem" "${SSL_DIR}/server.crt"
cp "${SSL_DIR}/privkey.pem" "${SSL_DIR}/server.key"

chmod 600 "${SSL_DIR}/privkey.pem" "${SSL_DIR}/server.key"
chmod 644 "${SSL_DIR}/fullchain.pem" "${SSL_DIR}/server.crt"

echo "==> TLS certificates successfully generated in ${SSL_DIR}:"
echo "    - fullchain.pem"
echo "    - privkey.pem"
