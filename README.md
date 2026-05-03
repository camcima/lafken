# Lafken

> *Lafken means "sea" in Mapudungun, the language of the Mapuche people of southern Chile and Argentina. Lafken is built with respect for the Mapuche cultural reference; the term refers to a geographic feature, not a sacred or politically charged concept.*

Lafken is an asset management service for organizations that handle user-uploaded images at scale.

## Repository layout

Turborepo monorepo using **pnpm** workspaces.

- `apps/backend` — NestJS service (Kysely + PostgreSQL).
- `apps/web` — React 19 + Vite admin console (CSR only).
- `shared/backend-api` — Backend DTOs, single source of truth.
- `shared/web-tests` — Playwright E2E.
- `shared/style-config`, `shared/typescript-config` — shared presets.

## Quickstart

Requires Node 22+, pnpm 10+, and Docker.

```bash
pnpm install
pnpm lefthook install
docker compose -f apps/backend/docker-compose.yml up -d
pnpm -F backend migrate
pnpm dev
```

Backend at `http://localhost:3000` (Swagger at `/openapi`); web at `http://localhost:5173`.

## Documentation

- Technical specification: [`spec/Lafken - Technical Specification.md`](spec/Lafken%20-%20Technical%20Specification.md)
- Detailed engineering guidelines: [`CLAUDE.md`](CLAUDE.md)

## License

Lafken will be released under the MIT License when it goes public.
