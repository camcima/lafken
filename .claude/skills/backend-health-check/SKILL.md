---
name: backend-health-check
description: Implements health check endpoints using @nestjs/terminus following Kubernetes conventions. Covers liveness, readiness, and startup probes, dependency checks (DB, cache, external services), and E2E testing. Use when adding health checks, configuring Kubernetes probes, or testing health endpoints.
---

# Health Check Endpoints

## Library

`@nestjs/terminus` - the standard NestJS health check library.

## Endpoints (Kubernetes Conventions)

| Endpoint            | Purpose               | Checks                   |
| ------------------- | --------------------- | ------------------------ |
| `/health`           | General health        | All checks               |
| `/health/liveness`  | Is the process alive? | Basic process health     |
| `/health/readiness` | Can it serve traffic? | DB, cache, external deps |

## Implementation

```typescript
// health/health.controller.ts
import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from "@nestjs/terminus";

@Controller("health")
@ApiTags("Health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck("database")]);
  }

  @Get("liveness")
  @HealthCheck()
  liveness() {
    return this.health.check([]);
  }

  @Get("readiness")
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.pingCheck("database"),
      // Add cache, external service checks here
    ]);
  }
}
```

## Module Setup

```typescript
// health/health.module.ts
import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { HealthController } from "./health.controller";

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
```

Register in `AppModule`:

```typescript
@Module({
  imports: [HealthModule /* other modules */],
})
export class AppModule {}
```

## Configuration Rules

- Set appropriate **timeouts** to prevent cascading failures
- Health checks should be **fast** (< 2 seconds)
- Include **all critical dependencies** in readiness check
- Liveness should be **lightweight** (no external calls)
- Document health endpoints in **OpenAPI/Swagger**

## Dependency Checks

Add checks for all critical dependencies:

```typescript
@Get("readiness")
@HealthCheck()
readiness() {
  return this.health.check([
    () => this.db.pingCheck("database", { timeout: 3000 }),
    // () => this.redis.pingCheck("cache", { timeout: 2000 }),
    // () => this.http.pingCheck("backend-api", backendApiUrl, { timeout: 5000 }),
  ]);
}
```

## E2E Testing

```typescript
describe("Health Check - GET /health", () => {
  let app: NestExpressApplication;
  let underlyingHttpServer: Server;

  beforeAll(async () => {
    const { appFixture } = await createAppModuleForE2ETest();
    app = appFixture;
    await app.init();
    underlyingHttpServer = app.getHttpServer();
  });

  afterAll(async () => {
    try {
      await app.close();
    } catch {
      /* do nothing */
    }
  });

  test("GET /health should return 200 with healthy status", async () => {
    const res = await request(underlyingHttpServer).get("/health");

    expect.soft(res.statusCode).toBe(HttpStatus.OK);
    expect.soft(res.type).toBe("application/json");
    expect.soft(res.body.status).toBe("ok");
  });

  test("GET /health/liveness should return 200", async () => {
    const res = await request(underlyingHttpServer).get("/health/liveness");

    expect.soft(res.statusCode).toBe(HttpStatus.OK);
    expect.soft(res.body.status).toBe("ok");
  });

  test("GET /health/readiness should return 200 when all deps healthy", async () => {
    const res = await request(underlyingHttpServer).get("/health/readiness");

    expect.soft(res.statusCode).toBe(HttpStatus.OK);
    expect.soft(res.body.status).toBe("ok");
  });
});
```
