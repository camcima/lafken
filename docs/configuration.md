# Configuration

Lafken follows the 12-factor rule: every value that varies between
environments comes from a single `.env` file per app, parsed once at
startup by a Zod schema (`apps/backend/src/shared/infrastructure/environment.configuration.ts`
and `apps/web/src/config/app-config.ts`). The app fails fast on
malformed or missing required values.

`.env.example` files are committed; concrete `.env` / `.env.local`
files are gitignored and provide overrides.

This page documents every variable. The `.env.example` files are the
runnable counterpart.

## Backend (`apps/backend/.env`)

### APP

| Variable                    | Default      | Required | Notes                                                                                              |
| --------------------------- | ------------ | -------- | -------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                  | `production` | yes      | `development`, `test`, `staging`, or `production`.                                                 |
| `APP_PORT`                  | —            | yes      | HTTP listen port.                                                                                  |
| `LOG_LEVEL`                 | `info`       | yes      | `debug`, `info`, or `error`.                                                                       |
| `PRETTY_LOGS`               | `false`      | yes      | Human-readable Pino in dev; structured JSON in production (forced off when `NODE_ENV=production`). |
| `CORS_ALLOWED_ORIGINS`      | `""`         | yes      | Comma-separated; empty disables CORS.                                                              |
| `CLOUD_ENDPOINT_DEFINITION` | `false`      | no       | Generates a Cloud Endpoints-flavoured OpenAPI spec when `true`.                                    |

### DATABASE

| Variable                            | Default     | Required                                    |
| ----------------------------------- | ----------- | ------------------------------------------- |
| `DB_HOST`                           | —           | yes                                         |
| `DB_PORT`                           | —           | yes                                         |
| `DB_USER`, `DB_NAME`, `DB_PASSWORD` | —           | yes                                         |
| `DB_SSL`                            | `false`     | yes                                         |
| `DATABASE_URL`                      | —           | yes (used by dbmate; not parsed by the app) |
| `DB_POOL_MIN` / `DB_POOL_MAX`       | `1` / `200` | yes                                         |
| `DB_POOL_IDLE_TIMEOUT_MS`           | `30000`     | yes                                         |
| `DB_POOL_CONNECTION_TIMEOUT_MS`     | `30000`     | yes                                         |
| `DB_STATEMENT_TIMEOUT_MS`           | `60000`     | yes                                         |
| `DB_QUERY_TIMEOUT_MS`               | `60000`     | yes (must be ≤ `DB_STATEMENT_TIMEOUT_MS`)   |
| `DB_IDLE_IN_TX_TIMEOUT_MS`          | `100000`    | yes                                         |

### AUTH (OIDC)

| Variable               | Default              | Required                  | Notes                                             |
| ---------------------- | -------------------- | ------------------------- | ------------------------------------------------- |
| `AUTH_PROVIDER`        | `oidc`               | yes                       | `mock` or `oidc`. Forced to `oidc` in production. |
| `OIDC_ISSUER`          | —                    | when `AUTH_PROVIDER=oidc` |                                                   |
| `OIDC_AUDIENCE`        | —                    | when `AUTH_PROVIDER=oidc` |                                                   |
| `OIDC_PRINCIPAL_CLAIM` | `preferred_username` | when `AUTH_PROVIDER=oidc` |                                                   |
| `OIDC_ROLES_CLAIM`     | `roles`              | when `AUTH_PROVIDER=oidc` |                                                   |

Application roles (granted by the mock provider, narrowable with
`x-test-roles` in tests):

- `lafken_platform_operator`
- `lafken_content_reviewer`
- `lafken_application_developer`
- `lafken_asset_deleter`
- `lafken_legal_hold_admin`

### GCS

| Variable                              | Default                                    | Required                                             |
| ------------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| `STORAGE_GCS_ENDPOINT`                | unset                                      | dev only (e.g. `http://localhost:4443` for fake-gcs) |
| `STORAGE_GCS_PREVIEW_SOURCE_ENDPOINT` | unset (defaults to `STORAGE_GCS_ENDPOINT`) | dev only (used by the renderer)                      |
| `GCS_SERVICE_ACCOUNT_JSON`            | unset                                      | prod (via workload identity if blank)                |

> tus (resumable) uploads are descoped from v1.0. The API still accepts `protocol: "tus"` for forward compatibility but always responds `422 TusNotConfiguredError`.

### imgproxy

| Variable                  | Default | Required                           |
| ------------------------- | ------- | ---------------------------------- |
| `IMGPROXY_BASE_URL`       | unset   | yes (e.g. `http://localhost:8081`) |
| `IMGPROXY_KEY`            | unset   | yes (hex-encoded HMAC-SHA256 key)  |
| `IMGPROXY_SALT`           | unset   | yes (hex-encoded HMAC-SHA256 salt) |
| `IMGPROXY_SIGNATURE_SIZE` | `32`    | yes                                |

`IMGPROXY_STRIP_METADATA=true` is set on the imgproxy container, not
the backend — it is a deployment concern.

### Processing — virus scan

| Variable                               | Default  | Notes                                           |
| -------------------------------------- | -------- | ----------------------------------------------- |
| `PROCESSING_VIRUS_SCAN_ADAPTER`        | `local`  | `local` or `clamav`.                            |
| `PROCESSING_VIRUS_SCAN_FORCE_INFECTED` | `false`  | When `local`, force quarantine for testing.     |
| `PROCESSING_VIRUS_SCAN_SIGNATURE`      | unset    | Signature label reported when forcing infected. |
| `CLAMAV_HOST`                          | `clamav` | When `clamav`.                                  |
| `CLAMAV_PORT`                          | `3310`   |                                                 |
| `CLAMAV_TIMEOUT_MS`                    | `30000`  |                                                 |
| `CLAMAV_CHUNK_SIZE_BYTES`              | `65536`  |                                                 |

### Processing — content moderation

| Variable                                       | Default | Notes                                                       |
| ---------------------------------------------- | ------- | ----------------------------------------------------------- |
| `PROCESSING_CONTENT_MODERATION_FORCE_DECISION` | unset   | Override policy decision: `pass` or `quarantine`. Dev-only. |

### Processing — worker

| Variable                                  | Default  | Purpose                                             |
| ----------------------------------------- | -------- | --------------------------------------------------- |
| `PROCESSING_WORKER_POLL_INTERVAL_MS`      | `1000`   | Claim loop tick.                                    |
| `PROCESSING_WORKER_CONCURRENCY`           | `1`      | Concurrent claims per worker process.               |
| `PROCESSING_WORKER_HEARTBEAT_INTERVAL_MS` | `10000`  | Heartbeat cadence per active claim.                 |
| `PROCESSING_WORKER_STALE_CLAIM_MS`        | `60000`  | Age past last heartbeat before reclaim.             |
| `PROCESSING_WORKER_MAX_ATTEMPTS`          | `5`      | Total attempts before terminal `processing_failed`. |
| `PROCESSING_WORKER_INITIAL_BACKOFF_MS`    | `1000`   | First-failure backoff base.                         |
| `PROCESSING_WORKER_BACKOFF_MULTIPLIER`    | `3`      | Exponential factor.                                 |
| `PROCESSING_WORKER_MAX_BACKOFF_MS`        | `600000` | Per-attempt cap.                                    |
| `PROCESSING_WORKER_WORKFLOW_TIMEOUT_MS`   | `900000` | Whole-workflow upper bound.                         |
| `PROCESSING_WORKER_SHUTDOWN_GRACE_MS`     | `30000`  | Window to drain in-flight claims on SIGTERM.        |

### Orphan-intent sweep

| Variable                          | Default  | Purpose                                             |
| --------------------------------- | -------- | --------------------------------------------------- |
| `ORPHAN_INTENT_SWEEP_INTERVAL_MS` | `60000`  | Sweep loop tick.                                    |
| `ORPHAN_INTENT_GRACE_MS`          | `300000` | Time after `upload_url_expires_at` before sweeping. |

### Telemetry (OTEL)

| Variable                      | Default                             | Notes                                                                                       |
| ----------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `OTEL_SERVICE_NAME`           | unset                               | Required when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.                                         |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | unset                               | OTLP collector URL.                                                                         |
| `OTEL_RESOURCE_ATTRIBUTES`    | unset                               | E.g. `deployment.environment.name=dev`. Required when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. |
| `OTEL_METRICS_ENABLED`        | `true` outside `test`/`development` | Toggles metric emission.                                                                    |

## Web (`apps/web/.env.local`)

The Vite dev plugin merges `.env.example` (committed defaults) with
`.env.local` (developer overrides) and writes `public/config.js`. In
production, `envsubst` writes the same shape from environment
variables at container start. App code reads via `getRuntimeValue()`
in `src/config/app-config.ts`.

| Variable                             | Notes                                                  |
| ------------------------------------ | ------------------------------------------------------ |
| `VITE_ENVIRONMENT`                   | `intg` or `prod`.                                      |
| `VITE_AUTH_PROVIDER`                 | `oidc` (real) or `mock` (Storybook / unit tests).      |
| `VITE_API_URL`                       | Backend base URL.                                      |
| `VITE_MONITORING_URL`                | Grafana Faro collector URL. Empty disables Faro.       |
| `VITE_OIDC_AUTHORITY`                | OIDC issuer.                                           |
| `VITE_OIDC_CLIENT_ID`                | Web SPA client id.                                     |
| `VITE_OIDC_AUDIENCE`                 | Backend audience (must match backend `OIDC_AUDIENCE`). |
| `VITE_OIDC_REDIRECT_URI`             | OIDC redirect.                                         |
| `VITE_OIDC_POST_LOGOUT_REDIRECT_URI` | OIDC post-logout.                                      |
| `VITE_OIDC_SCOPES`                   | Default `openid profile email`.                        |

The legacy `VITE_DEMO_DATA` and `VITE_MOCKED_API` keys were removed
in plan §4.

## Test environment

`apps/backend/.env.test` has the same shape as `.env`. The
integration / E2E test tier expects the test compose stack
(`docker compose -f apps/backend/docker-compose.test.yml`).
