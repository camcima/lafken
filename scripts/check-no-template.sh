#!/usr/bin/env bash
# Fails if any banned template/Azure/MSAL string appears in the repo.
# Allowlist: genuine GCP resource identifiers, historical review docs,
#            validate-deploy-config files (they intentionally contain these
#            strings as detection patterns), and GCP Cloud Endpoints ERB
#            templates that use Azure AD JWT for real infrastructure.

# Locate ripgrep — check common install locations if not in PATH
RG=$(command -v rg 2>/dev/null || true)
if [ -z "$RG" ]; then
  for candidate in \
    /usr/bin/rg \
    /usr/local/bin/rg \
    "$HOME/.local/bin/rg" \
    "$HOME/.gemini/tmp/bin/rg" \
    "$HOME/.cargo/bin/rg"; do
    if [ -x "$candidate" ]; then
      RG="$candidate"
      break
    fi
  done
fi
if [ -z "$RG" ]; then
  echo "ERROR: ripgrep (rg) not found. Install it to run this check." >&2
  exit 2
fi

BANNED_PATTERN='template-emantto-project|emx-tmpl|\beMantto\b|\bmsal\b|\bAZURE_|\bAUTH_CLIENT_ID\b|\bAUTH_TENANT_ID\b'

# GCP resource identifiers we keep (project IDs, TFC workspace names that map to real GCP IAM).
ALLOW_LITERALS='emx-intg-ab3d|emx-prod-63eb|emx-tmpl-intg-ab3d|emx-tmpl-prod-63eb'

hits=$("$RG" -in "$BANNED_PATTERN" \
  --glob='!**/node_modules/**' \
  --glob='!**/dist/**' \
  --glob='!**/.turbo/**' \
  --glob='!.git/**' \
  --glob='!CURRENT_IMPLEMENTATION_REVIEW.md' \
  --glob='!IMPLEMENTATION_REVIEW.md' \
  --glob='!CLAUDE.md' \
  --glob='!docs/superpowers/**' \
  --glob='!.gitlab-ci.yml' \
  --glob='!scripts/check-no-template.sh' \
  --glob='!apps/backend/src/scripts/validate-deploy-config.ts' \
  --glob='!apps/web/scripts/validate-deploy-config.ts' \
  --glob='!apps/backend/test/unit/scripts/validate-deploy-config.spec.ts' \
  --glob='!apps/web/test/scripts/validate-deploy-config.spec.ts' \
  --glob='!apps/backend/deploy/endpoints/openapi.yaml.erb' \
  --glob='!apps/backend/src/shared/presentation/documentation/open-api-loader.ts' \
  --glob='!infra/prod/_outputs.tf' \
  --glob='!infra/intg/_outputs.tf' \
  2>/dev/null | grep -v -E "$ALLOW_LITERALS" || true)

if [ -n "$hits" ]; then
  echo "FAIL: template/Azure/MSAL strings found:"
  echo "$hits"
  exit 1
fi

echo "OK: no template/Azure/MSAL stragglers."
