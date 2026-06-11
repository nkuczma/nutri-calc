#!/bin/sh
# Usage: E2E_COOKIE_0=... E2E_COOKIE_1=... E2E_DOMAIN=... sh e2e/write-cookies.sh
# E2E_DOMAIN defaults to "nutri-calc.natkuczma.workers.dev"
set -e

if [ -z "$E2E_COOKIE_0" ] || [ -z "$E2E_COOKIE_1" ]; then
  echo "Error: E2E_COOKIE_0 and E2E_COOKIE_1 must be set"
  exit 1
fi

DOMAIN="${E2E_DOMAIN:-nutri-calc.natkuczma.workers.dev}"
SECURE="true"
if [ "$DOMAIN" = "localhost" ]; then
  SECURE="false"
fi

cat > e2e/fixtures/cookies.json << EOF
[
  {
    "name": "sb-zdflqcdikfpxdihrpcrx-auth-token.0",
    "value": "$E2E_COOKIE_0",
    "domain": "$DOMAIN",
    "path": "/",
    "httpOnly": false,
    "secure": $SECURE,
    "sameSite": "Lax"
  },
  {
    "name": "sb-zdflqcdikfpxdihrpcrx-auth-token.1",
    "value": "$E2E_COOKIE_1",
    "domain": "$DOMAIN",
    "path": "/",
    "httpOnly": false,
    "secure": $SECURE,
    "sameSite": "Lax"
  }
]
EOF

echo "Written e2e/fixtures/cookies.json (domain: $DOMAIN, secure: $SECURE)"
