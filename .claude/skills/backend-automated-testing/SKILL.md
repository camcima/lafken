---
name: backend-automated-testing
description: Comprehensive guide to the three-tier testing strategy for NestJS backend applications. Covers unit testing (domain entities, mappers, use cases with mocks), functional/integration testing (module wiring, repository tests with real DB), and E2E testing (full HTTP flow with supertest). Use when writing any type of backend test or setting up test infrastructure.
---

# Backend Automated Testing

## Testing Pyramid

```
        /  E2E  \        ← Few: Critical HTTP flows only
       / Integration \   ← Some: Module wiring, service interactions
      /    Unit Tests   \← Many: Domain entities, value objects, use cases
```

## Test Runner & Tools

- **Vitest** for all test types
- **vitest-mock-extended** for typed mocks
- **supertest** for HTTP testing (E2E)
- **Faker.js** for test data factories

## Commands

```bash
pnpm --filter backend test          # All tests
pnpm --filter backend test:unit     # Unit tests only
pnpm --filter backend test:intg     # Integration tests only
pnpm --filter backend test:e2e      # E2E tests only
pnpm --filter backend test:cov      # Coverage report
```

---

## Unit Testing

**Purpose**: Test single units in isolation with mocked dependencies.

**Location**: Colocated with source for mappers (`*.spec.ts` next to `*.ts`), or under `test/unit/` for use cases.

**What to test**:

- Domain entities and value objects (business rules)
- Mappers (DB and response mappers)
- Use cases (with all dependencies mocked)
- Guards and utilities

**What NOT to unit test**:

- Controllers (test at E2E level)
- Repositories without real DB (use integration)
- Port files (`*.port.ts`)
- 3rd-party wrapper code

### Example: Unit Test for Use Case

```typescript
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

describe("RegisterUserUseCase", () => {
  let useCase: RegisterUserUseCase;
  let userQueryRepoMock: ReturnType<typeof mock<UserQueryRepositoryPort>>;

  beforeEach(() => {
    userQueryRepoMock = mock<UserQueryRepositoryPort>();
    const unitOfWorkMock = mock<UnitOfWorkPort>();
    unitOfWorkMock.execute.mockImplementation(async (cb) => cb());

    useCase = new RegisterUserUseCase(
      unitOfWorkMock,
      mock<DomainEventPublisherPort>(),
      userQueryRepoMock,
      mock<UserCommandRepositoryPort>(),
      mock<WorkCenterRepositoryPort>(),
      mock<RandomTitleGeneratorServicePort>(),
    );
  });

  it("should throw when email is taken", async () => {
    userQueryRepoMock.findByEmailAddress.mockResolvedValue(mock<User>());

    await expect(useCase.execute({ emailAddress: "taken@test.com" })).rejects.toThrow(
      UserEmailTakenError,
    );
  });
});
```

### Naming Convention

```typescript
describe("MyService", () => {
  it("#myMethod()", () => {
    /* ... */
  });
});
```

---

## Integration Testing (Functional Testing)

**Purpose**: Verify module wiring, service interactions, and repository behavior.

**Location**: `test/integration/<bounded-context>/` mirroring `src/` structure.

**What to test**:

- Module initialization (all modules except DatabaseModule)
- Use case + repository interactions
- Shared infrastructure services

**What NOT to test**:

- Controllers (test at E2E level)
- Individual repository methods without context

### Example: Module Wiring Test

```typescript
import { Test } from "@nestjs/testing";

import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";

import { NoopDatabaseModuleMock } from "../../../__mocks__/noop-database-module";

describe("UserInfrastructureModule", () => {
  test("should initialize with no dependency errors", async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [NoopDatabaseModuleMock.registerNoopTransaction(), UserInfrastructureModule],
    })
      .overrideModule(DatabaseModule)
      .useModule(NoopDatabaseModuleMock)
      .compile();

    const app = moduleFixture.createNestApplication();
    expect(app).toBeDefined();
    await expect(app.init()).resolves.not.toThrow();
    await app.close();
  });
});
```

**Key rules**:

- Replace `DatabaseModule` with `NoopDatabaseModuleMock`
- Mock external HTTP services
- Never start a real HTTP server
- Use Testcontainers for real DB when testing data access

---

## E2E Testing

**Purpose**: Full HTTP flow testing (Controller -> Use Case -> Repository -> DB).

**Location**: `test/e2e/<bounded-context>/presentation/<controller-name>/endpoint-<method>.e2e-spec.ts`

**What to test**:

- Happy path for each endpoint
- Standard error scenarios (400, 404, 422)
- Response format (status code AND content-type)

### Database Fixture Strategy: Teardown-Then-Setup

Use **teardown BEFORE setup** (not after). This way, if a test fails and you stop the suite, the failed test's data remains in the database for debugging.

Create a **centralized fixture method** that truncates all tables and inserts the base fixtures needed across tests. Since entities often depend on each other (e.g., users depend on work centers), a centralized setup ensures referential integrity and avoids duplicating boilerplate in every test file.

The centralized fixtures represent the **normal state** of the system — the common baseline most tests need. Most tests run against this baseline as-is. A few tests that need a different starting state **update or insert additional fixtures** on top of the base. For example, if the base fixtures include an active rule (with `activated_at` set), a test for "activate rule" would first update that fixture to set `activated_at = NULL`, then call the method under test.

```typescript
// test/e2e/__fixtures__/db-fixture-setup.ts

/**
 * Truncates all tables and inserts the base fixtures for E2E tests.
 * Call this at the START of each test (or describe block), not at the end.
 * If a test fails, data stays in the DB for inspection.
 */
export async function setupBaseFixtures(db: Kysely<any>) {
  // 1. Teardown: truncate in reverse-dependency order
  await sql`DELETE FROM users`.execute(db);
  await sql`DELETE FROM work_centers`.execute(db);

  // 2. Setup: insert base fixtures in dependency order
  await sql`
    INSERT INTO work_centers (base_name, location)
    VALUES ('SCL', 'Santiago'), ('LIM', 'Lima')
  `.execute(db);
}
```

### Example: E2E Test (Using Base Fixtures As-Is)

```typescript
describe("GET /v1/users/:user_email", () => {
  let app: NestExpressApplication;
  let db: DatabaseClient["connection"];
  let underlyingHttpServer: Server;

  beforeAll(async () => {
    const { appFixture, getDatabaseClient } = await createAppModuleForE2ETest();
    app = appFixture;
    await app.init();
    db = getDatabaseClient().connection;
    underlyingHttpServer = app.getHttpServer();
  });

  afterAll(async () => {
    try {
      await app.close();
    } catch {
      /* do nothing */
    }
  });

  test("should return user when found", async () => {
    // #region [db-setup] — teardown + base fixtures + test-specific insert
    await setupBaseFixtures(db);
    await sql`INSERT INTO users (email_address) VALUES ('test@test.com')`.execute(db);
    // #endregion

    const res = await request(underlyingHttpServer).get("/v1/users/test@test.com");

    expect.soft(res.statusCode).toBe(200);
    expect.soft(res.type).toBe("application/json");
    expect.soft(res.body.email).toBe("test@test.com");

    // No cleanup — next test's setupBaseFixtures() handles it
  });
});
```

### Example: E2E Test (Tweaking a Base Fixture)

When testing a specific scenario that requires a different state than the baseline, update the relevant fixture after calling `setupBaseFixtures()`:

```typescript
test("should activate an inactive rule", async () => {
  // #region [db-setup] — base fixtures give us an active rule; deactivate it for this test
  await setupBaseFixtures(db);
  await sql`UPDATE rules SET activated_at = NULL WHERE id = ${baseRuleId}`.execute(db);
  // #endregion

  const res = await request(underlyingHttpServer).post(`/v1/rules/${baseRuleId}/activate`);

  expect.soft(res.statusCode).toBe(200);

  // #region [db-checking]
  const row = await sql`SELECT activated_at FROM rules WHERE id = ${baseRuleId}`.execute(db);
  expect(row.rows[0].activated_at).not.toBeNull();
  // #endregion
});
```

### E2E Rules Checklist

- [ ] Use `supertest` (never `fetch`/`axios`)
- [ ] Use `createAppModuleForE2ETest()` bootstrap
- [ ] **Teardown-then-setup**: call `setupBaseFixtures(db)` at the start of each test, not cleanup at the end
- [ ] Most tests use base fixtures as-is; only tweak (update/insert) when testing a specific scenario
- [ ] Use `#region` comments: `[db-setup]`, `[external-services-setup]`, `[db-checking]`
- [ ] AAA pattern (Arrange-Act-Assert)
- [ ] Verify `statusCode` AND `type`
- [ ] Use `expect.soft()` for multiple assertions
- [ ] Mock external services via `app.get<DeepMockProxy<Port>>(Port)`
- [ ] Use factories for test data (no hardcoded JSON)
- [ ] One endpoint per test file

---

## Files NOT Requiring Tests

- Files in `test/` directory
- `*.port.ts` (abstract classes)
- `presentation/mappers/*.mapper.ts`
- `presentation/middlewares/` (3rd-party wrappers)
- `shared/infrastructure/environment.configuration.ts`
- `shared/infrastructure/logger/`
- `shared/infrastructure/telemetry/`
