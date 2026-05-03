#!/bin/sh
set -e

# ============================================================================
# Security: Input Validation and Sanitization
# ============================================================================

# Function to validate required variables
validate_required() {
  if [ -z "$1" ]; then
    echo "ERROR: $2 is required" >&2
    exit 1
  fi
}

# Function to validate URL format (prevents injection)
validate_url() {
  local value="$1"
  local name="$2"

  if [ -n "$value" ]; then
    # Must start with http:// or https://
    # Must not contain spaces, quotes, or script tags
    if ! echo "$value" | grep -qE '^https?://[^[:space:]"'"'"'<>]+$'; then
      echo "ERROR: $name must be a valid URL without spaces or special characters: $value" >&2
      exit 1
    fi

    # Additional check: must not contain JavaScript injection patterns
    if echo "$value" | grep -qiE '(javascript:|data:|vbscript:|on\w+\s*=)'; then
      echo "ERROR: $name contains potentially dangerous content" >&2
      exit 1
    fi
  fi
}

# Function to validate UUID format (for Azure IDs)
validate_uuid() {
  local value="$1"
  local name="$2"

  if [ -n "$value" ]; then
    if ! echo "$value" | grep -qE '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'; then
      echo "ERROR: $name must be a valid UUID format: $value" >&2
      exit 1
    fi
  fi
}

# Function to validate enum values (prevents injection)
validate_enum() {
  local value="$1"
  local name="$2"
  shift 2
  local valid_values="$@"

  if [ -n "$value" ]; then
    for valid in $valid_values; do
      if [ "$value" = "$valid" ]; then
        return 0
      fi
    done
    echo "ERROR: $name must be one of: $valid_values. Got: $value" >&2
    exit 1
  fi
}

# Function to sanitize JavaScript string (escape special characters)
sanitize_js_string() {
  local value="$1"
  # Escape backslashes first
  value=$(echo "$value" | sed 's/\\/\\\\/g')
  # Escape single quotes
  value=$(echo "$value" | sed "s/'/\\\\'/g")
  # Escape newlines
  value=$(echo "$value" | sed 's/\n/\\n/g')
  # Escape carriage returns
  value=$(echo "$value" | sed 's/\r/\\r/g')
  # Remove null bytes
  value=$(echo "$value" | tr -d '\0')
  echo "$value"
}

# ============================================================================
# Validate Required Variables
# ============================================================================

validate_required "$ENVIRONMENT" "ENVIRONMENT"
validate_required "$AUTH_PROVIDER" "AUTH_PROVIDER"

# ============================================================================
# Validate Format and Content
# ============================================================================

# Validate ENVIRONMENT (enum)
validate_enum "$ENVIRONMENT" "ENVIRONMENT" "intg" "prod"

# Validate AUTH_PROVIDER (enum)
validate_enum "$AUTH_PROVIDER" "AUTH_PROVIDER" "mock" "msal"

# Validate URLs (if provided)
[ -n "$API_URL" ] && validate_url "$API_URL" "API_URL"
[ -n "$AZURE_REDIRECT_URI" ] && validate_url "$AZURE_REDIRECT_URI" "AZURE_REDIRECT_URI"
[ -n "$AZURE_POST_LOGOUT_REDIRECT_URI" ] && validate_url "$AZURE_POST_LOGOUT_REDIRECT_URI" "AZURE_POST_LOGOUT_REDIRECT_URI"
[ -n "$MONITORING_URL" ] && validate_url "$MONITORING_URL" "MONITORING_URL"

# Validate UUIDs (if provided and AUTH_PROVIDER is azure-ad)
if [ "$AUTH_PROVIDER" = "msal" ]; then
  [ -n "$AZURE_CLIENT_ID" ] && validate_uuid "$AZURE_CLIENT_ID" "AZURE_CLIENT_ID"
  [ -n "$AZURE_TENANT_ID" ] && validate_uuid "$AZURE_TENANT_ID" "AZURE_TENANT_ID"
fi

# ============================================================================
# Sanitize Values (escape for JavaScript)
# ============================================================================

ENVIRONMENT_SANITIZED=$(sanitize_js_string "${ENVIRONMENT}")
AUTH_PROVIDER_SANITIZED=$(sanitize_js_string "${AUTH_PROVIDER}")
AZURE_CLIENT_ID_SANITIZED=$(sanitize_js_string "${AZURE_CLIENT_ID:-}")
AZURE_REDIRECT_URI_SANITIZED=$(sanitize_js_string "${AZURE_REDIRECT_URI:-}")
AZURE_TENANT_ID_SANITIZED=$(sanitize_js_string "${AZURE_TENANT_ID:-}")
AZURE_POST_LOGOUT_REDIRECT_URI_SANITIZED=$(sanitize_js_string "${AZURE_POST_LOGOUT_REDIRECT_URI:-}")
MONITORING_URL_SANITIZED=$(sanitize_js_string "${MONITORING_URL:-}")
API_URL_SANITIZED=$(sanitize_js_string "${API_URL:-}")

# ============================================================================
# Generate config.js with Sanitized Values
# ============================================================================

# envsubst doesn't support ${VAR:-default} syntax, so we need to handle defaults manually
# Replace ${VAR:-default} patterns with just ${VAR} and set defaults if variables are empty
ENVIRONMENT_VALUE="${ENVIRONMENT_SANITIZED:-intg}"
AUTH_PROVIDER_VALUE="${AUTH_PROVIDER_SANITIZED:-mock}"
AZURE_CLIENT_ID_VALUE="${AZURE_CLIENT_ID_SANITIZED:-}"
AZURE_REDIRECT_URI_VALUE="${AZURE_REDIRECT_URI_SANITIZED:-}"
AZURE_TENANT_ID_VALUE="${AZURE_TENANT_ID_SANITIZED:-}"
AZURE_POST_LOGOUT_REDIRECT_URI_VALUE="${AZURE_POST_LOGOUT_REDIRECT_URI_SANITIZED:-}"
MONITORING_URL_VALUE="${MONITORING_URL_SANITIZED:-}"
API_URL_VALUE="${API_URL_SANITIZED:-}"

# First, replace ${VAR:-default} patterns with ${VAR} in the template
# Then use envsubst to substitute the actual values
sed -e 's/\${ENVIRONMENT:-intg}/\${ENVIRONMENT}/g' \
    -e 's/\${AUTH_PROVIDER:-mock}/\${AUTH_PROVIDER}/g' \
    -e 's/\${AZURE_CLIENT_ID:-}/\${AZURE_CLIENT_ID}/g' \
    -e 's/\${AZURE_REDIRECT_URI:-}/\${AZURE_REDIRECT_URI}/g' \
    -e 's/\${AZURE_TENANT_ID:-}/\${AZURE_TENANT_ID}/g' \
    -e 's/\${AZURE_POST_LOGOUT_REDIRECT_URI:-}/\${AZURE_POST_LOGOUT_REDIRECT_URI}/g' \
    -e 's/\${MONITORING_URL:-}/\${MONITORING_URL}/g' \
    -e 's/\${API_URL:-}/\${API_URL}/g' \
    ./config.js.template | \
ENVIRONMENT="$ENVIRONMENT_VALUE" \
AUTH_PROVIDER="$AUTH_PROVIDER_VALUE" \
AZURE_CLIENT_ID="$AZURE_CLIENT_ID_VALUE" \
AZURE_REDIRECT_URI="$AZURE_REDIRECT_URI_VALUE" \
AZURE_TENANT_ID="$AZURE_TENANT_ID_VALUE" \
AZURE_POST_LOGOUT_REDIRECT_URI="$AZURE_POST_LOGOUT_REDIRECT_URI_VALUE" \
MONITORING_URL="$MONITORING_URL_VALUE" \
API_URL="$API_URL_VALUE" \
envsubst '${ENVIRONMENT} ${AUTH_PROVIDER} ${AZURE_CLIENT_ID} ${AZURE_REDIRECT_URI} ${AZURE_TENANT_ID} ${AZURE_POST_LOGOUT_REDIRECT_URI} ${MONITORING_URL} ${API_URL}' \
  > config.js

# ============================================================================
# Set Secure File Permissions
# ============================================================================

chmod 644 config.js
chown nginx:nginx config.js

# ============================================================================
# Validate Generated File
# ============================================================================

# Check file was generated
if [ ! -f config.js ]; then
  echo "ERROR: Failed to generate config.js file" >&2
  exit 1
fi

# Check file contains expected content
if ! grep -q "__APP_CONFIG__" config.js; then
  echo "ERROR: Generated config.js is invalid - missing __APP_CONFIG__" >&2
  rm -f config.js
  exit 1
fi

# Security check: Ensure no script injection in generated file
if grep -qiE '(javascript:|data:|vbscript:|<script|eval\s*\()' config.js; then
  echo "ERROR: Generated config.js contains potentially dangerous content" >&2
  rm -f config.js
  exit 1
fi

# ============================================================================
# Cleanup and Logging
# ============================================================================

# Cleanup function (always runs, even on error)
cleanup() {
  rm -f ./config.js.template
}
trap cleanup EXIT

# Log success (without exposing sensitive values)
echo "INFO: config.js generated successfully for environment: $ENVIRONMENT" >&2

# ============================================================================
# Configure Nginx Port
# ============================================================================

# Cloud Run sets PORT dynamically - update nginx config to use it
NGINX_PORT=${PORT:-8080}

# Update port in server block config
sed -i "s/listen 8080;/listen ${NGINX_PORT};/g" /etc/nginx/conf.d/default.conf

# Ensure main nginx.conf logs to stdout/stderr (Cloud Run best practice)
# Replace any error_log directive in the main nginx.conf (handles various formats)
sed -i 's|^[^#]*error_log.*|    error_log /dev/stderr warn;|' /etc/nginx/nginx.conf 2>/dev/null || \
sed -i '/error_log/c\    error_log /dev/stderr warn;' /etc/nginx/nginx.conf 2>/dev/null || true

# Also ensure access_log is set in main config if it exists
sed -i '/^[^#]*access_log/c\    access_log /dev/stdout;' /etc/nginx/nginx.conf 2>/dev/null || true

# ============================================================================
# Configure CSP connect-src dynamically from API_URL and MONITORING_URL
# ============================================================================

# Extract protocol + host from each URL (strips any path component)
API_ORIGIN=$(echo "${API_URL:-}" | sed -E 's|(https?://[^/]+).*|\1|')
MONITORING_ORIGIN=$(echo "${MONITORING_URL:-}" | sed -E 's|(https?://[^/]+).*|\1|')

# Replace the $api_origin placeholder in nginx.conf with the real origins.
# The placeholder must remain a literal string in nginx.conf (nginx does not
# interpolate shell variables — entrypoint.sh is the one doing the substitution).
CSP_ORIGINS="${API_ORIGIN}${MONITORING_ORIGIN:+ ${MONITORING_ORIGIN}}"
sed -i "s|\\\$api_origin|${CSP_ORIGINS}|g" /etc/nginx/conf.d/default.conf

# Verify nginx config is valid
nginx -t >&2

# ============================================================================
# Start Nginx
# ============================================================================

# Drop privileges before launching nginx so the master process no longer runs
# as root. Port 8080 does not require CAP_NET_BIND_SERVICE, and file ownership
# for /etc/nginx/conf.d/default.conf and /opt/app-root/src was set to the nginx
# user at image-build time (see Dockerfile).
#
# If neither su-exec nor setpriv is available in the base image, fall back to
# running nginx as root with a master-process "user nginx;" directive so that
# at least the worker processes drop privileges. This keeps the container
# functional on base images that do not ship a privilege-drop helper.
if command -v su-exec >/dev/null 2>&1; then
  exec su-exec nginx:nginx nginx -g "daemon off;"
elif command -v setpriv >/dev/null 2>&1; then
  exec setpriv --reuid=nginx --regid=nginx --clear-groups nginx -g "daemon off;"
else
  echo "WARN: neither su-exec nor setpriv available; nginx master will run as root (F-12)" >&2
  exec nginx -g "daemon off; user nginx;"
fi