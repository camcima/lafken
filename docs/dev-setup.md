# Dev setup

A clean checkout to a working local stack in under five minutes.

## Prerequisites

- **Node ≥ 22** (`node --version`).
- **pnpm ≥ 10** (`pnpm --version`). Use `corepack enable` if needed.
- **Docker** (Engine 24+).
- A POSIX shell (`bash` or `zsh`).

The repo uses pnpm workspaces. Do not invoke `npm` or `yarn` —
`pnpm-lock.yaml` is the only lockfile.

## Install

```bash
git clone <repo-url> lafken
cd lafken
pnpm install
pnpm lefthook install   # installs git hooks once
```

## Environment files

| File                     | What for                                                                      |
| ------------------------ | ----------------------------------------------------------------------------- |
| `apps/backend/.env`      | Backend API + worker. Copy from `apps/backend/.env.example`.                  |
| `apps/backend/.env.test` | Backend integration / E2E. Copy from `apps/backend/.env.test.example`.        |
| `apps/web/.env.local`    | Web app overrides. Copy only if you need to override `apps/web/.env.example`. |

`apps/web/.env.example` is committed and used as the baseline; you
only need `.env.local` to override individual values.

See [`configuration.md`](./configuration.md) for the full env-var
reference.

## Backing services (Docker Compose)

```bash
docker compose -f apps/backend/docker-compose.yml up -d
```

This starts:

- PostgreSQL 18 on `localhost:5433`.
- fake-gcs-server on `localhost:4443`.
- imgproxy on `localhost:8081`.
- ClamAV on `localhost:3310` (when `PROCESSING_VIRUS_SCAN_ADAPTER=clamav`).
- A local OIDC provider on `localhost:8095` (when `AUTH_PROVIDER=oidc`).

For the integration / E2E tier, bring up the dedicated test stack:

```bash
docker compose -f apps/backend/docker-compose.test.yml up -d
```

## Migrations

```bash
pnpm -F backend migrate
```

After applying migrations, regenerate the Kysely types:

```bash
pnpm -F backend migrate
pnpm -F backend kysely-codegen
```

For convenience there's a combined script:

```bash
pnpm -F backend db:update
```

…which runs both in sequence. CI fails commits where migrations and `apps/backend/src/shared/infrastructure/persistence/db.types.ts` are out of step.

## Run

`pnpm -F backend dev` starts the API and the processing worker
together via `concurrently`:

```bash
# Backend API at http://localhost:3000  (Swagger at /openapi)
# Processing worker (same process group)
pnpm -F backend dev

# Web admin console at http://localhost:5173
pnpm -F web dev
```

If you want to run the API and worker in separate terminals — useful
when one is hot-reloading on a different cadence — use the underlying
scripts directly:

```bash
pnpm -F backend dev:api
pnpm -F backend dev:worker
```

`pnpm dev` from the repo root runs everything via Turborepo if you
prefer a single command.

## Test tiers

| Command                            | What runs                                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `pnpm -F backend unit/test`        | Pure domain + use-case tests. Fast.                                                                                        |
| `pnpm -F backend integration/test` | Repository + adapter tests against real Postgres. Requires `docker compose -f apps/backend/docker-compose.test.yml up -d`. |
| `pnpm -F backend e2e/test`         | Full HTTP flow tests. Same compose dependency.                                                                             |
| `pnpm -F web test`                 | Web Vitest + RTL component tests.                                                                                          |
| `pnpm -F web-tests test:e2e`       | Playwright E2E against a built web app + local backend.                                                                    |
| `pnpm test`                        | Runs every project's default test command via Turborepo.                                                                   |
| `pnpm type-check`                  | Type-checks every workspace.                                                                                               |
| `pnpm -F backend dep-check`        | Dependency Cruiser — fails on layer violations.                                                                            |

## Common pitfalls

| Symptom                      | Cause                                       | Fix                                                                                                                               |
| ---------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `ECONNREFUSED 5433`          | Postgres not running.                       | `docker compose -f apps/backend/docker-compose.yml up -d`.                                                                        |
| `JWKS could not be parsed`   | OIDC provider not running.                  | Start the dev OIDC container (`dev-oidc`, port 8095).                                                                             |
| Web app shows stale config   | `public/config.js` not regenerated.         | Restart `pnpm -F web dev` (the Vite dev plugin regenerates on boot).                                                              |
| `db.types.ts` is out of date | Forgot to regenerate types after migrating. | `pnpm -F backend db:update` (runs migrate + kysely-codegen). CI fails commits where migrations and `db.types.ts` are out of sync. |

## Next

- [`architecture.md`](./architecture.md) for the layout.
- [`upload-flow.md`](./upload-flow.md) and
  [`processing-pipeline.md`](./processing-pipeline.md) for the runtime
  behavior.
- [`configuration.md`](./configuration.md) for every env var.
