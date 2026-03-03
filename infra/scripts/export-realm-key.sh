#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# export-realm-key.sh
#
# Fetches the REALM_PUBLIC_KEY from a running Keycloak instance and prints
# the shell export statement ready to paste into your .env or CI secrets.
#
# Prerequisites: curl, jq
#
# Usage:
#   ./export-realm-key.sh \
#     --admin-url https://auth.maternal-system.example.com \
#     --admin-user admin \
#     --admin-pass "$(aws secretsmanager get-secret-value \
#         --secret-id /maternal-system-eks/keycloak/admin \
#         --query SecretString --output text | jq -r .password)"
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ADMIN_URL=""
ADMIN_USER="admin"
ADMIN_PASS=""
REALM="maternal-system"
CLIENT_ID="api-server"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --admin-url)  ADMIN_URL="$2";  shift 2 ;;
    --admin-user) ADMIN_USER="$2"; shift 2 ;;
    --admin-pass) ADMIN_PASS="$2"; shift 2 ;;
    --realm)      REALM="$2";      shift 2 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

[[ -z "$ADMIN_URL"  ]] && { echo "ERROR: --admin-url is required"; exit 1; }
[[ -z "$ADMIN_PASS" ]] && { echo "ERROR: --admin-pass is required"; exit 1; }

echo "🔑  Fetching admin access token..."
TOKEN=$(curl -s -X POST \
  "${ADMIN_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${ADMIN_USER}" \
  -d "password=${ADMIN_PASS}" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | jq -r '.access_token')

[[ "$TOKEN" == "null" || -z "$TOKEN" ]] && { echo "ERROR: Failed to get admin token"; exit 1; }

echo "🔑  Fetching realm public key..."
PUBLIC_KEY=$(curl -s \
  "${ADMIN_URL}/realms/${REALM}" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.public_key')

[[ "$PUBLIC_KEY" == "null" || -z "$PUBLIC_KEY" ]] && { echo "ERROR: Failed to get public key"; exit 1; }

echo "✅  Done. Add the following to your .env / CI secrets:"
echo ""
echo "export REALM_PUBLIC_KEY=\"-----BEGIN PUBLIC KEY-----"
echo "${PUBLIC_KEY}"
echo "-----END PUBLIC KEY-----\""
echo ""
echo "# To patch the Kubernetes ConfigMap directly:"
echo "kubectl patch configmap identity-keycloak-config -n identity \\"
echo "  --type merge \\"
printf "  --patch '{\"data\":{\"REALM_PUBLIC_KEY\":\"-----BEGIN PUBLIC KEY-----\\n%s\\n-----END PUBLIC KEY-----\"}}'\n" "$PUBLIC_KEY"
