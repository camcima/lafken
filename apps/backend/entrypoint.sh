#!/bin/sh
#
# Container entrypoint for the backend Cloud Run service.
#
# Responsibilities (in order):
#   1. Fetch runtime secrets from Hashicorp Vault (via GCP auth method) and
#      inject them into this shell's environment, so every child process
#      (dbmate, the Node.js app) inherits them automatically.
#   2. Run pending database migrations with dbmate.
#   3. Exec the Node.js app, replacing this shell so signals from Cloud Run
#      (SIGTERM on revision shutdown) are delivered directly to Node.
#
# Contract with `./scripts/display-vault-secrets.mjs`:
#   - Reads the `ENV` env var (must be `intg` or `prod`) to pick the Vault
#     mount path / role.
#   - Writes POSIX-safe `KEY='value'` lines to stdout (single-quoted, with
#     embedded single quotes escaped as `'\''`). That output is `eval`d here
#     under `set -a` so each KEY is also marked for export.
#
# Failure behavior:
#   `set -eu` makes the script abort on any failed command or unset variable.
#   If Vault auth, secret fetch, or dbmate fails, the container exits non-zero
#   and Cloud Run will retry per its restart policy - the app never starts
#   without its secrets.
#
set -eu

# Fetch secrets from Vault and inject them into this shell's environment.
# Output format: KEY='value' lines (single-quoted, with embedded single quotes escaped as '\'').
echo "🔄 [entrypoint.sh] Fetching the vault secret using the display-vault-secrets script and injecting into the shell environment ..."
VAULT_SECRETS="$(node ./scripts/display-vault-secrets.mjs)"
set -a
eval "$VAULT_SECRETS"
set +a
unset VAULT_SECRETS
echo "✅ Vault secret fetched successfully!"

# DBMate needs PGPASSWORD and DATABASE_URL; DB_PASSWORD comes from the vault secrets above.
echo "🔄 [entrypoint.sh] Running dbmate migrations (non-blocking)..."
export PGPASSWORD="$DB_PASSWORD" # for dbmate to use
export DATABASE_URL="postgres://$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=disable"
# TODO: In the future we should no longer have to run database migrations in this entrypoint file due to several issues that this approach has.
./node_modules/.bin/dbmate \
  --env "DATABASE_URL" \
  --no-dump-schema \
  --migrations-table "schema_migrations" \
  --migrations-dir "./db/migrations" \
  up
unset PGPASSWORD DATABASE_URL

# Start Application — secrets already in the environment, no --env-file needed.
echo "🚀 [entrypoint.sh] Starting the application..."
exec node ./dist/main.js
