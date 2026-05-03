# System Architecture Overview

High-level summary of how the monorepo components (apps, shared packages, infrastructure, and CI/CD) interact.

## Monorepo Layout

```
template-emantto-project/
  apps/
    backend/       NestJS API (public API, hexagonal architecture)
    web/           React 19 SPA (Vite, CSR only)
  shared/
    backend-api/   Backend DTOs (Single Source of Truth)
    style-config/  Shared ESLint/Prettier configs
    typescript-config/  Shared tsconfig bases
    web-tests/     Shared Playwright/Vitest helpers for the web app
  infra/
    _base/         Shared Terraform provider config
    intg/          Integration environment resources
    prod/          Production environment resources
```

Managed with **Turborepo** (task orchestration) and **pnpm workspaces**.

---

## Component Interaction

```
                        Internet
                           |
                     [Akamai CDN/WAF]
                           |
                  [GCP Global Load Balancer]
                    (Cloud Armor corp policy)
                      /            \
                     /              \
               /be/*            /* (default)
                  |                  |
          ┌──────────────┐   ┌─────────────┐
          │  Backend     │   │ Web Cloud   │
          │  Cloud Run   │   │ Run Service │
          │  Service     │   │             │
          │ ┌──────────┐ │   │   nginx     │
          │ │  ESPv2   │ │   │  (static)   │
          │ │ (envoy)  │ │   └─────────────┘
          │ └────┬─────┘ │
          │      │       │
          │ ┌────▼─────┐ │
          │ │ Backend  │ │
          │ │   App    │ │
          │ │ (NestJS) │ │
          │ └────┬─────┘ │
          └──────┼───────┘
                 │ Cloud SQL Proxy
          ┌──────▼───────┐
          │ Cloud SQL    │
          │ PostgreSQL 18│
          └──────────────┘
```

### Request Flow

1. **Client** hits `https://<app>.appslatam.com/...`
2. **GCP Global HTTPS Load Balancer** terminates SSL (Akamai-managed cert) and applies Cloud Armor WAF rules
3. **URL Map** routes:
   - `/be/*` -> Backend Cloud Run service
   - `/*` (everything else) -> Web Cloud Run service (nginx serving static SPA assets)
4. **Backend Cloud Run** is a dual-container service:
   - **ESPv2 (main container, port 8080)**: Envoy-based proxy that fetches Cloud Endpoints config and validates/routes requests
   - **Backend App (sidecar, port 3000)**: NestJS app that handles auth, business logic, and database access
5. **Backend -> Cloud SQL**: Connects via Cloud SQL Auth Proxy over the private VPC network (`vpc-lan`). The backend service account has scoped `roles/cloudsql.client` restricted to its specific instance

---

## App Responsibilities

### Web (`apps/web`)

- **React 19 SPA** built with Vite (client-side rendering only)
- Routing: TanStack Router (file-based)
- Server state: TanStack Query via service classes
- Auth: MSAL (Azure AD) via `AuthProviderFactory` -- acquires tokens, injects into Backend API requests
- Observability: Grafana Faro (RUM, web vitals, distributed tracing)
- Served by **nginx** on Cloud Run (static files + runtime config injection via `config.js.template`)

### Backend (`apps/backend`)

- **NestJS** (public API, strict hexagonal architecture)
- **Handles Azure AD authentication** via `AuthModule`: `@AuthenticatedEndpoint()`, `@EndpointRequiredRoles()`, and `AzureAdBearerAuthnStrategy`
- Database: **Kysely** query builder + **dbmate** migrations against PostgreSQL
- Follows Ports & Adapters: domain defines abstract ports, infrastructure implements adapters
- Global error handling: `CatchAllExceptionsForHttp` converts domain/validation errors to RFC 7807
- Cloud Endpoints config (OpenAPI spec) deployed alongside for ESPv2 gateway validation
- Observability: OpenTelemetry via `nestjs-otel`

---

## Shared Packages

| Package                     | Purpose                                                                             | Consumers                                   |
| --------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------- |
| `@shared/backend-api`       | Backend request/response DTOs with `class-validator` + `@nestjs/swagger` decorators | Backend (runtime), Web (`import type` only) |
| `@shared/style-config`      | ESLint + Prettier configurations                                                    | All apps                                    |
| `@shared/typescript-config` | Base `tsconfig.json` presets                                                        | All apps                                    |
| `web-tests`                 | Playwright config, MSW handlers, Vitest helpers                                     | Web app tests                               |

**Dependency direction**: Web -> `@shared/backend-api` (types only). No circular dependencies.

---

## Infrastructure (Terraform)

Managed via **Terraform Cloud** (organization: `LATAM_AIRLINES`). Two environments with mirrored configurations:

| Resource      | INTG                 | PROD                 |
| ------------- | -------------------- | -------------------- |
| GCP Project   | `emx-intg-ab3d`      | `emx-prod-63eb`      |
| TFC Workspace | `emx-tmpl-intg-ab3d` | `emx-tmpl-prod-63eb` |
| Region        | `us-east1`           | `us-east1`           |

### Resources Provisioned Per Environment

| Resource                       | Details                                                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Cloud SQL (PostgreSQL 18)**  | Enterprise edition, zonal, private IP only on `vpc-lan`, query insights enabled, daily backups (7 retained), deletion protection on |
| **Service Accounts**           | `backend-sa` (Cloud SQL client, Secret Manager accessor, network user, service controller for ESPv2), `web-sa` (static serving)     |
| **Cloud Run IAM**              | Backend + Web publicly invocable (`allUsers`)                                                                                       |
| **Global HTTPS Load Balancer** | External managed LB, Akamai SSL cert, HTTPS redirect, Cloud Armor `cloudarmor-corp` policy                                          |
| **URL Map**                    | Default -> Web backend service, `/be/*` -> Backend backend service                                                                  |
| **Serverless NEGs**            | One per Cloud Run service (Backend, Web) connecting LB to Cloud Run                                                                 |
| **Azure App Registration**     | Via `latam-appregister` module for MSAL/Azure AD SPA auth                                                                           |

### Key Differences: INTG vs PROD

- INTG: `disk_autoresize = false` (fixed 30GB) | PROD: `disk_autoresize = true`
- INTG: Redirect URIs include `*.intg.appslatam.com` | PROD: `*.appslatam.com`

### Secrets Management (HashiCorp Vault)

- **Vault server**: `https://emx-vault.appslatam.com`
- **Auth method**: GCP Workload Identity -- Cloud Run service accounts authenticate to Vault using their GCP identity
- **Secret path**: `/v1/{project-key}/data/{env}/{project-name}/secrets`
- **Runtime injection**: The Backend `entrypoint.sh` runs `display-vault-secrets.mjs` at startup, fetches secrets from Vault, appends them to `.env`, then runs dbmate migrations before starting the app
- **GCP Secret Manager**: Backend SA also has `roles/secretmanager.secretAccessor` for any GCP-native secrets

### Cloud Run Runtime Specs

| Service | CPU | Memory | Min/Max Instances (INTG) | Min/Max Instances (PROD) | Ingress             |
| ------- | --- | ------ | ------------------------ | ------------------------ | ------------------- |
| Backend | 2-4 | 512Mi  | 0-2                      | 0-8                      | Internal + Cloud LB |
| Web     | 2   | 512Mi  | 0-2                      | 0-3                      | Public via LB       |

- Backend has liveness (`/v1/health`) and startup (TCP:3000) probes
- Backend is the only service with database migrations (dbmate) in its entrypoint

### `first_deploy_cloud_run_done` Flag

Cloud Run IAM bindings, NEGs, backend services, URL map, and LB module are all gated behind `var.first_deploy_cloud_run_done == "true"`. This is a TFC workspace variable set to `"true"` after the first CI/CD deployment creates the Cloud Run services, avoiding Terraform errors referencing services that don't exist yet.

---

## CI/CD Pipelines (GitLab CI)

### Pipeline Triggers

| Trigger                     | What Runs                                                |
| --------------------------- | -------------------------------------------------------- |
| **MR push** (non-draft)     | CI for all apps + CD to INTG + Infra plan/apply for INTG |
| **Merge to default branch** | Auto-release (conventional commits -> version tag)       |
| **Release tag** (`v*`)      | CD to PROD + Infra apply for PROD                        |
| **Manual** (`web` source)   | Deploy to chosen env (`MANUAL_DEPLOY_ENV`)               |

### Root Pipeline (`.gitlab-ci.yml`)

```
Stages: infra:plan -> infra:apply -> trigger_apps -> release
```

- **Infra**: Uses `deploy-terraform` component. INTG auto-approved; PROD requires approval. Only runs when `infra/` files change.
- **Trigger Apps**: Uses `trigger-apps` component to spawn child pipelines for `backend`, `web` (each app's own `.gitlab-ci.yml`).
- **Release**: Uses `release-conventional` component. Triggers on merge commits, creates version tags following conventional commits.

### Backend Pipeline

```
setup:pnpm -> lint -> unit_test -> integration_test -> api_e2e_test -> collect_coverage -> quality -> build -> package -> deploy
```

- **3-tier testing**: Unit tests -> Integration tests (real DB via CI service) -> E2E tests (full HTTP flow with `supertest`)
- **Coverage**: Collected from all three test tiers and merged
- **Quality gate**: SonarQube analysis
- **Deploy**: Cloud Run to INTG (on MR) and PROD (on tag)
- **Cloud Endpoints deployment**: Includes `deploy-cloud-endpoints` component for both INTG and PROD -- deploys the OpenAPI spec that ESPv2 fetches at startup

### Web Pipeline

```
setup:pnpm -> lint -> test -> web_e2e_test -> quality -> build:pnpm -> package -> deploy
```

- E2E tests run with `AUTH_PROVIDER=mock` (no real Azure AD in CI)
- Uses Playwright for browser-based E2E tests

### All Apps Share

- **`setup@0.1.2`**: pnpm install with frozen lockfile
- **`lint-and-format@0.1.2`**: ESLint + Prettier checks
- **`build@0.1.2`**: `pnpm turbo run build`
- **`quality@0.1.2`**: SonarQube analysis
- **`package@0.1.2`**: Docker build + push to GCR
- **`deploy-cloud-run@2.8.1`**: Deploy to Cloud Run (INTG on MR, PROD on tag)

All CI/CD components are sourced from `latamairlines/oper/emx/config/devops/components/`.

### Git Hooks (Lefthook)

Pre-commit and pre-push hooks enforce quality locally:

- **Pre-commit**: Prettier formatting + per-app ESLint on staged files
- **Commit message**: `commitlint` enforces Conventional Commits format

### Release Automation

Uses `release-conventional@2.8.2` component. On merge to main, it detects Conventional Commits, generates a version tag (`v*`), and triggers the PROD deployment pipeline.

---

## Authentication Flow

```
 Browser                     Backend
    |                            |
    |-- MSAL login (Azure AD)    |
    |<- access token             |
    |                            |
    |-- GET /be/... ------------>|
    |   Authorization: Bearer    |
    |                            |-- validate token
    |                            |   (AzureAdBearerAuthnStrategy)
    |                            |-- check roles
    |                            |   (@EndpointRequiredRoles)
    |                            |
    |                            |-- process request
    |<- response ----------------|
```

- **Web**: Acquires Azure AD tokens via MSAL, sends as Bearer token to Backend
- **Backend**: Validates tokens directly using `AzureAdBearerAuthnStrategy`, enforces role-based access via `@EndpointRequiredRoles`
- **Azure App Registration**: Provisioned by Terraform (`latam-appregister` module), one per environment

---

## Observability Stack

| Layer      | Tool                              | Purpose                                              |
| ---------- | --------------------------------- | ---------------------------------------------------- |
| Web        | Grafana Faro                      | RUM, error tracking, web vitals, distributed tracing |
| Backend    | OpenTelemetry + `nestjs-otel`     | Distributed tracing, custom spans                    |
| Logging    | `nestjs-pino` via `AppLoggerPort` | Structured JSON logs (prod), human-readable (dev)    |
| Collection | Grafana Cloud                     | Aggregation and visualization                        |

Trace context propagates: Web (Faro) -> Backend via standard trace context headers.

---

## Supply Chain Security

Configured in `pnpm-workspace.yaml`:

- **`strictDepBuilds: true`**: Fails install if any dependency has unreviewed build scripts
- **`blockExoticSubdeps: true`**: Transitive deps cannot use git/tarball sources
- **`trustPolicy: no-downgrade`**: Prevents trust-level downgrades in packages
- **`minimumReleaseAge: 4320`** (3 days): Quarantine period for newly published packages
- Trusted publishers (NestJS, Azure, Google Cloud, TanStack, etc.) are exempt from the quarantine
