# Engineering Guidelines

## About this codebase

This is a TypeScript codebase using Vitest for testing, structured around hexagonal architecture (ports & adapters). The folder layout reflects the layers:

- `domain/` — entities, value objects, domain services, and port interfaces. Pure, framework-free, no I/O.
- `application/` — use cases that orchestrate domain logic through ports. No framework or transport details.
- `infrastructure/` — adapters that implement ports: repositories, HTTP clients, message consumers, framework wiring, the composition root.

Dependencies point inward only: `infrastructure` → `application` → `domain`.

## How to use this file

Rules below are enforced via Dependency Cruiser and ESLint — violations fail CI. When writing or modifying code, follow these rules. When in doubt, prefer the more decoupled option (a port, an injected dependency, a value object) over the shorter one. If a rule seems to conflict with the task, surface the conflict rather than silently bending the rule.

## Hexagonal Architecture
- **Domain has no external dependencies.** Code in `domain/` must not import from `infrastructure/`, `application/`, frameworks, ORMs, HTTP clients, or third-party libraries beyond standard language utilities. If the domain needs something external, define a port (interface) it owns and let outer layers implement it.
- **Dependencies point inward.** `infrastructure` → `application` → `domain`. Never the reverse. If you need to import "up," you need a port.
- **Ports live with their consumer, not their implementation.** A `UserRepository` interface lives in `domain/` or `application/`. The Postgres implementation lives in `infrastructure/`. The consumer owns the contract.
- **Use cases are the only entry point to domain logic.** Controllers, CLI handlers, and message consumers call use cases — never repositories or domain services directly.
- **No framework decorators in the domain.** No `@Injectable`, `@Entity`, `@Column`, `@Controller` on domain classes. Persistence and transport concerns belong to adapters.
- **Throw domain errors from the domain.** `UserNotFoundError`, not `NotFoundException`. Adapters translate domain errors into transport-specific responses.
- **Don't leak ORM entities past the repository.** Repositories return domain objects or plain data, not ActiveRecord/TypeORM entities. Mapping happens at the adapter boundary.

## Dependency Injection
- **Inject services, repositories, and clients via the constructor.** Never use `new` to instantiate them inside method bodies. Value objects, DTOs, and errors are fine to instantiate inline.

❌ Don't:
```ts
class OrderService {
  process(order: Order) {
    const mailer = new Mailer();
    mailer.send(order);
  }
}
```

✅ Do:
```ts
class OrderService {
  constructor(private readonly mailer: Mailer) {}
  process(order: Order) {
    this.mailer.send(order);
  }
}
```

- **No service locators, static `getInstance()`, or global mutable state.** Dependencies come in through the constructor.

## SOLID

- **One reason to change per class.** If a class name contains "and" or needs multiple verbs to describe, split it.
- **Depend on interfaces across layer boundaries and for I/O.** Within a single layer, depending on concrete classes is fine — don't create one-implementation interfaces just for ceremony.
- **Prefer composition over inheritance.** Use inheritance only for true "is-a" relationships at the same abstraction level. Never inherit to share code — extract a collaborator instead.
- **Keep interfaces small and client-specific.** Split fat interfaces by use case (`UserReader`, `UserWriter`) rather than defaulting to CRUD.

## Domain Modeling

- **Pure domain logic.** Domain methods must not perform I/O, read clocks, generate IDs, or call `Math.random()`. Inject these as ports (`Clock`, `IdGenerator`) or pass as parameters.
- **Make illegal states unrepresentable.** Use value objects for anything with rules (`Email`, `Money`, `UserId`) instead of primitives. Validate at construction; once constructed, the object is always valid.
- **Prefer immutability.** Domain objects expose behavior, not setters. Return new instances instead of mutating. Mutation is allowed inside aggregates when natural, but reads from outside should be immutable.
- **No anemic models.** Behavior lives on the entity or value object that owns the data. If a class is only getters/setters and the logic lives in a `*Service`, the model is in the wrong place.
- **No "Manager," "Helper," or "Util" classes in the domain.** These names signal missing abstractions. Name things after what they are in the domain.

## Configuration (12-Factor)

- **Strict separation of config from code.** Anything that varies between environments (dev, staging, prod) — credentials, hostnames, URLs, feature flags, ports, resource handles — must come from environment variables. Never hardcode environment-specific values.
- **No config files checked into source control with environment-specific values.** A `.env.example` documenting required variables is fine; an actual `.env` with secrets is not.
- **Read environment variables once, at startup, into a typed config object.** Don't sprinkle `process.env.X` across the codebase. Parse, validate, and fail fast on missing or malformed config at boot.

❌ Don't:
```ts
function sendEmail(to: string) {
  return fetch(`${process.env.MAIL_API_URL}/send`, { ... });
}
```

✅ Do:
```ts
// config/index.ts — parsed and validated once at startup
export const config = loadConfig({
  mailApiUrl: requireEnv('MAIL_API_URL'),
  // ...
});

// adapter
class HttpMailer {
  constructor(private readonly config: MailerConfig) {}
  send(to: string) {
    return fetch(`${this.config.apiUrl}/send`, { ... });
  }
}
```

- **Inject config into adapters; never read env vars inside domain or application code.** The config object flows in through the composition root and is passed via constructor like any other dependency.
- **No environment checks in business logic.** `if (process.env.NODE_ENV === 'production')` branching inside use cases or domain code is forbidden. If behavior must differ, inject a different adapter at the composition root.
- **Treat secrets as config.** API keys, DB passwords, and signing keys are environment variables — never literals, never committed, never logged.

## Runtime & Operations (12-Factor)
- **Processes are stateless and share-nothing.** Never store request data, user sessions, or cached results in module-level variables, class statics, or process memory across requests. State that must persist goes to a backing service (DB, cache, object store).

❌ Don't:
```ts
const cache = new Map<string, User>(); // module-level state

class UserService {
  async getUser(id: string) {
    if (cache.has(id)) return cache.get(id);
    // ...
  }
}
```

✅ Do:
```ts
class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly cache: CachePort, // Redis, Memcached, etc.
  ) {}

  async getUser(id: string) {
    const cached = await this.cache.get(id);
    if (cached) return cached;
    // ...
  }
}
```

- **Dev/prod parity.** Use the same backing service types across environments (Postgres in dev and prod, not SQLite in dev and Postgres in prod). Differences between environments come from config, never from code paths. No `if (env === 'development')` branches in application code — inject different adapters at the composition root.

- **Graceful shutdown.** Handle `SIGTERM`/`SIGINT`: stop accepting new work, finish or checkpoint in-flight work, close DB connections and consumers cleanly. Long-running jobs and message handlers must be idempotent so they're safe to retry after a crash or redeploy.

- **Logs are event streams to stdout.** Write structured log events (JSON) to stdout. Never open log files, rotate logs, or ship logs from inside the application. Log routing, aggregation, and retention are infrastructure concerns.

❌ Don't:
```ts
fs.appendFileSync('app.log', `[${new Date()}] user ${id} logged in\n`);
```

✅ Do:
```ts
logger.info({ event: 'user.logged_in', userId: id });
```

- **Admin tasks are separate entry points.** Migrations, backfills, and one-off scripts are separate processes in the same codebase, using the same config and adapters as the main app. Never expose them as HTTP endpoints, never hide them inside request handlers, never run them automatically on app boot (except for migrations gated by an explicit deploy step).

- **No runtime builds.** Compilation, dependency installation, and asset bundling happen at build time, not at runtime. Built artifacts are immutable; the running process only reads config and executes.

## Testing
- **Follow the test pyramid.** Most tests are fast unit tests on domain logic and use cases. A smaller layer of integration tests covers adapters and the boundaries they cross. A thin layer of end-to-end tests covers critical user journeys. Inverted pyramids (mostly E2E) are slow, flaky, and forbidden.
- **Unit-test the domain in isolation.** Domain entities, value objects, and domain services run in pure unit tests with no test doubles, no framework boot, no I/O. If you need a mock to test domain logic, the logic has a hidden dependency that should be a port.
- **Test use cases with in-memory port implementations.** Use cases run with hand-written in-memory adapters (`InMemoryUserRepository`, `FakeClock`, `InMemoryEventBus`) — not mocking libraries. If a use case can't be tested this way, it has a hidden dependency.
- **Always integration-test adapters.** Repositories, HTTP clients, message consumers, and any other adapter must have integration tests that exercise the real backing service (real Postgres, real Redis, real broker) via Testcontainers or an equivalent ephemeral instance. Mocking the database to test a repository proves nothing.
  
❌ Don't:
```ts
// "Testing" the repository by mocking the ORM — proves nothing about SQL, schema, or mapping.
const mockOrm = { query: jest.fn().mockResolvedValue([{ id: '1', name: 'Ada' }]) };
const repo = new PostgresUserRepository(mockOrm);
```

✅ Do:
```ts
// Real Postgres via Testcontainers; the test fails if SQL, schema, or mapping is wrong.
const container = await new PostgresContainer().start();
const repo = new PostgresUserRepository(container.getConnection());
await repo.save(new User(...));
expect(await repo.findById(id)).toEqual(expectedUser);
```

- **Contract-test every port that has more than one implementation.** Run the same test suite against the in-memory fake and the real adapter. This guarantees the fake used in use case tests behaves like production — otherwise green unit tests can hide real bugs.
- **Test behavior, not implementation.** Assert on outcomes: state changes, return values, events emitted, calls made to ports. Never assert on private fields, internal method invocations, or the order of calls inside a single object.
- **One reason for a test to fail.** Each test exercises one behavior. Tests with multiple unrelated assertions or that verify several scenarios in one body are split into separate cases.
- **Tests are deterministic.** No reliance on wall-clock time, real randomness, network calls to third parties, or shared mutable state between tests. Inject a `Clock`, a seeded RNG, and stub external HTTP at the adapter layer. Flaky tests are bugs, not nuisances.
- **For adapter tests that can't inject a clock, use Vitest's fake timers.** When testing adapters that wrap third-party code calling `Date.now()` or `setTimeout` directly, use `vi.useFakeTimers()` and `vi.setSystemTime()`. In domain and use case tests, inject a `Clock` port instead — never reach for fake timers there.
- **Tests are independent and order-agnostic.** Any test must pass when run alone, in parallel, or in any order. No "this test depends on the previous one having seeded data."
- **End-to-end tests cover happy paths only.** E2E tests are expensive and slow — reserve them for critical user journeys (signup, checkout, core workflow). Edge cases, error handling, and validation belong in unit and integration tests, not E2E.
- **Test names describe behavior, not methods.** `it('rejects orders below the minimum amount')` — not `it('process()')` or `it('test1')`. The test name should read as a specification.
- **Repository integration tests don't use the repository's own methods for setup or assertions.** Insert test data with raw SQL or a separate test helper, and verify outcomes by querying the database directly. Using the repository to test itself can hide bugs where read and write paths share the same defect.
- **Clean the database in `beforeEach`, not `afterEach`.** This leaves data in the DB after the last test for manual inspection.
- **New repositories require an integration test file** at `test/integration/<context>/persistence/<name>.repository.spec.ts`, created in the same change.
- **Use the shared DB client setup helpers** for integration tests. Don't roll your own connection setup.

## Forbidden
- Circular dependencies between modules. Extract the shared concept into a third module.
- Reading `process.env` outside the config module.
- Instantiating injectable dependencies (services, repositories, clients) inside method bodies.
- Importing infrastructure or framework code from the domain.
- Anemic domain models with logic-bearing `*Service` siblings.
- Module-level mutable state, class statics, or in-memory caches that persist across requests.
- Writing logs to files, rotating logs, or shipping logs from inside the application.
- Admin/maintenance tasks exposed as HTTP endpoints or hidden inside request handlers.
- Environment-specific branching (`if (env === 'production')`) in domain or application code.

## TypeScript

- **Explicit types on every variable in `src/`.** Production code requires explicit type annotations on declarations, parameters, and return types. Test code (`test/`, `*.spec.ts`) is exempt.
- **Imports are sorted.** Enforced by ESLint/Prettier — don't hand-order imports.
- **Use absolute imports with the `@` alias.** Never use `../../../` relative paths to cross module boundaries. Relative imports are fine within the same module/folder.

## Database

- **Every table has `created_at` and `updated_at` columns**, even append-only tables. Set defaults to `now()`.
- **Every table has its own `set_updated_at()` trigger** that calls a shared trigger function. Do not duplicate the function per table — share the function, attach a trigger per table.
- **UUIDv7 primary keys via PostgreSQL 18's native `uuidv7()`.** Do not use `gen_random_uuid()` (UUIDv4) for new tables.
- **Never use `ON DELETE CASCADE` on foreign keys.** Cascades hide intent and cause silent data loss. Handle deletion explicitly in application code or use `ON DELETE RESTRICT`.
- **Migrations are dbmate raw SQL with up and down sections.** Always provide both directions.
- **Use `IF NOT EXISTS` / `IF EXISTS` in migrations** for idempotency on partial reapplication.
- **Run `kysely-codegen` after every migration** to keep `db.types.ts` in sync. Commits that change migrations without updating `db.types.ts` fail CI.
- **Run dbmate with `--no-dump-schema`.** Do not auto-generate `schema.sql`.

## Workflows

- **Prefer `@duraflows` over hand-rolled state machines.** When modeling a process with status transitions, use `@duraflows` rather than hardcoding statuses and transition logic in services.

## Frontend

- **When adopting a design from an external source (e.g., Claude Design), start from their proposal files** (jsx/tsx) and adapt them to project conventions. Do not piecewise-modify existing components to match the proposal — replace, then adapt.

## Project Layout

Turborepo monorepo, **pnpm** workspaces. Use `pnpm`/`pnpx` only — never `npm` or `yarn`.

- `apps/backend` — NestJS + Kysely + PostgreSQL.
- `apps/web` — React + Vite SPA, **CSR only** (no SSR / RSC / Server Actions).
- `shared/backend-api` — Backend DTOs, SSOT for public API shapes.
- `shared/web-tests` — Playwright E2E for `apps/web`.
- `shared/style-config`, `shared/typescript-config` — shared presets.

Env files: `apps/backend/.env` (+ `.env.test`), `apps/web/.env.local`. Schemas: `apps/backend/src/shared/infrastructure/environment.configuration.ts` and `apps/web/src/config/app-config.ts`. OpenAPI: `/openapi`, `/openapi.json`, `/openapi.yaml`.

Filter a workspace: `pnpm -F <workspace> <script>`. Setup hooks once: `pnpm lefthook install`.

## Backend Specifics

Layers per bounded context: `domain/`, `application/`, `infrastructure/`, **`presentation/`** (controllers + response mappers). Dependency rule enforced by `pnpm dep-check`.

- **Ports are abstract classes**, not interfaces. Wire via NestJS `useClass` / `useExisting` / `useFactory`. Constructor injection only — no `ModuleRef`.
- Controllers translate domain errors to HTTP. Domain/application **never** throw `HttpException`.
- Errors emitted as **RFC 7807 `application/problem+json`** via `CatchAllExceptionsForHttp`. `DomainError` → 422, `ValidationError` → 400.
- Logging via `AppLoggerPort` (Pino). Redact PII / auth headers, include correlation IDs.
- Migrations with **dbmate**: `pnpm migrate`, `migrate:new <name>`, `migrate:status`, `migrate:rollback`.
- Tests centralized under `apps/backend/test/` (not colocated; mapper unit tests are the exception). Three Vitest projects: `pnpm unit/test`, `pnpm integration/test`, `pnpm e2e/test`. E2E needs the test DB up via `docker compose -f docker-compose.test.yml`.

## Frontend Specifics

- Routing: **TanStack Router** (file-based, Zod-validated `searchParams` — URL is source of truth).
- Server state: **TanStack Query**. UI state: **Zustand**, only when needed.
- Auth: `IAuthProvider` + `AuthProviderFactory` (MSAL or Mock); `AuthGuard` / `AuthMonitoredGuard` for protected routes.
- Forms: `react-hook-form` + Zod. UI: shadcn/ui + Radix + Tailwind v4 + `cva`. i18n: `react-i18next`.
- Monitoring: Grafana Faro via `withMonitoring` HOC, initialized **post-auth only**. No-op when `MONITORING_URL` is empty.
- Runtime config: `public/config.js` from `VITE_*` (dev) or `envsubst` (prod), validated by Zod in `app-config.ts`.
- Playwright lives in `shared/web-tests`: `pnpm test:e2e` (preview build), `pnpm test:dev` (UI mode).

## Code Style

- **No `any`** without a justifying comment.
- **`interface` over `type`** for object shapes. `import type` for type-only.
- Path aliases (`@/...`) across module boundaries — never `../../../`.
- **No barrel / re-export `index` files. No `import *`.**
- File suffixes signal the layer: `.entity.ts`, `.value-object.ts`, `.error.ts`, `.repository.port.ts`, `.service.port.ts`, `.use-case.ts`, `.controller.ts`, `.module.ts`, `-infrastructure.module.ts`, `.db.ts`.

### Naming

| Element           | Convention                 | Example                   |
| ----------------- | -------------------------- | ------------------------- |
| Files             | kebab-case                 | `user-query.service.ts`   |
| Classes           | PascalCase                 | `UserQueryService`        |
| Internal types    | `I` prefix                 | `IWorkCenterProps`        |
| Constants         | SCREAMING_SNAKE_CASE       | `DATABASE_URL`            |
| DB tables         | plural snake_case          | `work_centers`            |
| DB columns        | snake_case                 | `email_address`           |
| Ports             | `*Port` (abstract class)   | `UserQueryRepositoryPort` |
| Use cases         | `*UseCase`                 | `RegisterUserUseCase`     |
| DTOs              | `*DTO` / `*ResponseDTO`    | `RegisterNewUserDTO`      |
| Domain errors     | `*Error`                   | `UserNotFoundError`       |
| DB mappers        | `*DbMapper`                | `WorkCenterDbMapper`      |
| Response mappers  | `*ResponseMapper` (static) | `UserResponseMapper`      |

## API Design

- REST, plural kebab-case (`/work-centers`). Nouns, not verbs.
- Versioning via `@Controller({ path, version })` — never hardcode `v2/`.
- Request DTOs: `class-validator` + `@ApiProperty`. Response DTOs: `@ApiProperty` only.
- Pagination: `makePaginatedRequestInputDto()` / `makePaginatedResponseDto()` from `@shared/backend-api`.
- Auth decorators: `@AuthenticatedEndpoint()`, `@EndpointRequiredRoles([...])`.
- Deprecation: RFC 9745 `Deprecation` + RFC 8594 `Sunset` headers + `@ApiOperation({ deprecated: true })`.

## Commits & Hooks

**Conventional Commits**, enforced by commitlint. Lefthook runs Prettier + ESLint on pre-commit, commitlint on commit-msg, and `pnpm test` + `type-check` + `syncpack lint` on pre-push. **Don't bypass with `--no-verify`** unless explicitly asked.

## Don'ts (project-specific)

- Don't touch `.gitlab-ci.yml` — CI is managed separately.
- Don't create alternative root folders or "starter" scaffolds; extend existing modules.