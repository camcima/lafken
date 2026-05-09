# Lafken

Lafken is an asset-management service for organizations that handle
user-uploaded images at scale. It owns the full lifecycle: signed
direct-to-storage uploads (simple or resumable tus), a virus and
content-moderation pipeline, signed serving via imgproxy, namespace +
versioned policy + versioned preset modeling, audit, legal holds, and
an operator console.

> *Lafken means "sea" in Mapudungun, the language of the Mapuche
> people of southern Chile and Argentina. The term refers to a
> geographic feature, not a sacred or politically charged concept.*

## Features (v1.0)

- Hexagonal NestJS backend with eight bounded contexts plus shared
  infrastructure.
- GCS storage with V4 signed direct-to-storage uploads.
- Resumable tus uploads via a tusd sidecar.
- Async processing pipeline (virus scan → magic-byte detection →
  image inspection → content moderation → finalize).
- Signed-mode serving via imgproxy with per-render signed source
  URLs.
- Namespace + versioned policy + versioned preset model.
- OIDC authentication with role-gated endpoints.
- Configuration audit log + asset state-transition log.
- Operator console (namespaces, presets, storage bindings, asset
  search, quarantine, legal holds, audit, health).
- React 19 SPA admin console that dogfoods the same SDK
  (`@lafken/client`, `@lafken/upload`, `@lafken/react`) external
  consumers use.
- OpenTelemetry metrics for upload, pipeline, serving, authz, and
  API request duration.

## Quickstart (≈ 5 minutes)

Prereqs: Node ≥ 22, pnpm ≥ 10, Docker.

```bash
git clone <repo-url> lafken
cd lafken
pnpm install
pnpm lefthook install
docker compose -f apps/backend/docker-compose.yml up -d
pnpm -F backend migrate
pnpm dev
```

This brings up:

- Backend API at <http://localhost:3000> (Swagger at `/openapi`).
- Processing worker (separate Node process).
- Admin console at <http://localhost:5173>.

Sign in to the admin console with the local OIDC provider (or with
`AUTH_PROVIDER=mock` set, any non-empty bearer token works), pick a
namespace, drop a JPEG into the upload page, and watch it transition
through `awaiting_upload → processing → ready`.

For the full setup walkthrough see [`docs/dev-setup.md`](./docs/dev-setup.md).

## Repository layout

| Path | Description |
| ---- | ----------- |
| `apps/backend` | NestJS service. Public API + processing worker. |
| `apps/web` | React 19 SPA (Vite, CSR only). |
| `packages/client` | `@lafken/client` — typed REST SDK. |
| `packages/upload` | `@lafken/upload` — browser upload manager. |
| `packages/react` | `@lafken/react` — hooks and components. |
| `shared/backend-api` | Backend DTOs, single source of truth. |
| `shared/web-tests` | Playwright E2E. |

## Documentation

- [Architecture](./docs/architecture.md)
- [Dev setup](./docs/dev-setup.md)
- [Configuration reference](./docs/configuration.md)
- [Upload flow](./docs/upload-flow.md)
- [Processing pipeline](./docs/processing-pipeline.md)
- [Serving](./docs/serving.md)
- [SDK](./docs/sdk.md)
- [Admin console](./docs/admin-console.md)
- [Technical specification](./spec/Lafken%20-%20Technical%20Specification.md)
- [Engineering guidelines](./CLAUDE.md)
- [ADR — primary key strategy](./docs/adr/0001-pk-strategy.md)

## License

MIT. See [`LICENSE`](./LICENSE).
