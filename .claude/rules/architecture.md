# Architecture & Code Organization

## Monorepo Structure (Turborepo)

```
apps/
  backend/     # NestJS + Kysely + PostgreSQL (Public API). Strict Hexagonal.
  web/         # React 19 (Vite SPA) + TanStack Router/Query. CSR only.
shared/
  backend-api/ # Backend presentation DTOs (Single Source of Truth for the public APIs)
```

## Hexagonal Architecture (Backend)

### Module Structure (one per bounded context)

```
apps/backend/src/<bounded-context>/
  <bounded-context>.module.ts
  domain/
    entities/
    value-objects/
    errors/
    repositories/       # Port interfaces (abstract classes)
  application/
    services/
    use-cases/
  infrastructure/
    <bounded-context>-infrastructure.module.ts
    clients/
    persistence/
      mappers/          # DB row <-> Domain entity mappers
      schemas/          # *.db.ts Kysely table definitions
      repositories/     # Port implementations (adapters)
  presentation/
    mappers/            # Domain entity -> Response DTO mappers
    controllers/
```

### Test Structure (centralized, not colocated)

```
apps/backend/test/
  __mocks__/           # Shared mock utilities
  unit/
    <bounded-context>/
  integration/
    <bounded-context>/
  e2e/
    <bounded-context>/
      presentation/
        <controller-name>/
          endpoint-<method-name>.e2e-spec.ts
    common/
      factories/       # Test data factories (Faker.js)
```

Exception: Unit test files for mappers ARE colocated (e.g., `user-response.mapper.spec.ts` next to `user-response.mapper.ts`).

## Dependency Rule (STRICT)

```
Presentation -> Application -> Domain <- Infrastructure
```

| Layer              | CAN depend on                              | CANNOT depend on                                      |
| ------------------ | ------------------------------------------ | ----------------------------------------------------- |
| **Domain**         | Nothing (pure TS, no framework decorators) | Application, Infrastructure, Presentation             |
| **Application**    | Domain, Ports (abstract classes)           | Infrastructure, Presentation                          |
| **Infrastructure** | Domain (types/ports only)                  | Application (except implementing ports), Presentation |
| **Presentation**   | Application + DTOs                         | Infrastructure directly                               |

Enforce with: `pnpm dep-check` (dependency-cruiser).

## Naming Bounded Contexts

- Use domain nouns: `Billing`, `Checkout`, `Pricing`, `UserProfile`
- Never use: `Services`, `Data`, `Gateway`, `ShortenUrl` (verbs or technical names)

## Dependency Injection Rules

- **Constructor injection ONLY** (no property/setter injection)
- **No NestJS decorators** in domain/application layers (framework-agnostic core)
- **NestJS modules are the wiring layer**: use `useExisting`/`useFactory` to bind ports to adapters
- **No `ModuleRef`** or service locator pattern
- **No direct `process.env`**: use `environmentConfiguration` object from `shared/infrastructure/environment.configuration.ts`

```typescript
// Infrastructure module wires ports to adapters
@Module({
  providers: [
    { provide: UserQueryRepositoryPort, useClass: UserRepository },
    { provide: UnitOfWorkPort, useExisting: DatabaseUnitOfWork },
  ],
  exports: [UserQueryRepositoryPort, UnitOfWorkPort],
})
export class UserInfrastructureModule {}
```

## Key Architectural Constraints

- **No Anemic Models**: Entities MUST contain business logic (e.g., `User.makeNew()`), not just data
- **No Leaky Abstractions**: Domain entities NEVER leave the backend. Map to DTOs in the Controller
- **Ports & Adapters**: Domain defines Ports (abstract classes); Infrastructure implements Adapters
- Composition of data from multiple aggregates is a **service responsibility**, not repository
- **No circular dependencies** between aggregates
- **Entities never access repositories** directly
- **Repositories never call other repositories**

## Frontend Architecture (Vite SPA)

- **Client-Side Rendering (CSR) ONLY**: No SSR, Server Components, or Server Actions
- **URL is Truth**: use `searchParams` via TanStack Router
- Server state via TanStack Query, UI state via Zustand (if needed)
- All data fetching is client-side via service classes + React Query hooks

## Scaffolding Rule

This is a **template-based project**. When adding features:

- **Extend existing structure** - mirror existing module patterns
- **Never create** alternative root folders, duplicate app setups, or starter projects
