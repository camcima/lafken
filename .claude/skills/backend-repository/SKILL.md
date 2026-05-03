---
name: backend-repository
description: Implements the repository pattern with ports and adapters for database access using Kysely. Covers domain port definition, infrastructure adapter implementation, DB mappers, and integration testing with real database. Use when creating a new repository, querying the database, or writing repository integration tests.
---

# Backend Repository

## Architecture

```
domain/repositories/         → Port (abstract class defining the contract)
infrastructure/persistence/
  schemas/                   → DB row types (*.db.ts)
  mappers/                   → DB row <-> Domain entity mappers
  repositories/postgresql/   → Adapter (implementation using Kysely)
```

## Step 1: Define the Port (Domain Layer)

```typescript
// domain/repositories/work-center.repository.port.ts
import { PaginatedResult } from "@shared/backend-api";

import { IUnpersistedWorkCenter, WorkCenter } from "../entities/work-center.entity";

export abstract class WorkCenterRepositoryPort {
  abstract saveNew(workCenter: IUnpersistedWorkCenter): Promise<WorkCenter>;
  abstract saveNewMany(workCenters: IUnpersistedWorkCenter[]): Promise<WorkCenter[]>;
  abstract findAllPaged(opts: {
    pagination: { page: number; limit: number; order: ("desc" | "asc")[]; orderBy: "createdAt"[] };
  }): Promise<PaginatedResult<WorkCenter>>;
  abstract findByBaseName(baseName: string): Promise<WorkCenter | null>;
}
```

**Rules for ports**:

- Abstract class (not interface) for NestJS DI compatibility
- Return domain entities, not DB rows
- Return `null` for missing rows (don't throw)
- No Kysely/SQL imports in domain layer

## Step 2: Define DB Schema Types

```typescript
// infrastructure/persistence/schemas/work-center.db.ts
export interface IWorkCenterDbRow {
  id: string;
  created_at: Date;
  updated_at: Date;
  base_name: string;
  location: string;
}

export interface IWorkCenterDbRowInsert {
  base_name: string;
  location: string;
}
```

## Step 3: Create DB Mapper

```typescript
// infrastructure/persistence/mappers/work-center-db.mapper.ts
import { WorkCenter } from "@/user-profile/domain/entities/work-center.entity";

import { IWorkCenterDbRow } from "../schemas/work-center.db";

export class WorkCenterDbMapper {
  static toDomain(row: IWorkCenterDbRow): WorkCenter {
    return new WorkCenter({
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      baseName: row.base_name,
      location: row.location,
    });
  }
}
```

## Step 4: Implement the Adapter

```typescript
// infrastructure/repositories/postgresql/work-center.repository.ts
import { Injectable } from "@nestjs/common";
import { sql } from "kysely";

import { BaseRepository } from "@/shared/infrastructure/persistence/base-repository";
import { WorkCenterRepositoryPort } from "@/user-profile/domain/repositories/work-center.repository.port";

import { WorkCenterDbMapper } from "../../persistence/mappers/work-center-db.mapper";
import { IWorkCenterDbRow } from "../../persistence/schemas/work-center.db";

@Injectable()
export class WorkCenterRepository extends BaseRepository implements WorkCenterRepositoryPort {
  async findByBaseName(baseName: string): Promise<WorkCenter | null> {
    const db = this.currentTransaction ?? this.dbClient.connection;

    const result = await sql<IWorkCenterDbRow>`
      SELECT * FROM work_centers WHERE base_name = ${baseName} LIMIT 1
    `.execute(db);

    const row = result.rows[0];
    if (!row) return null;

    return WorkCenterDbMapper.toDomain(row);
  }

  async saveNew(workCenter: IUnpersistedWorkCenter): Promise<WorkCenter> {
    const db = this.currentTransaction ?? this.dbClient.connection;

    const result = await sql<IWorkCenterDbRow>`
      INSERT INTO work_centers (base_name, location)
      VALUES (${workCenter.baseName}, ${workCenter.location})
      RETURNING *
    `.execute(db);

    return WorkCenterDbMapper.toDomain(result.rows[0]);
  }
}
```

**Key patterns**:

- Extend `BaseRepository` for transaction support
- Use `this.currentTransaction ?? this.dbClient.connection` to respect UnitOfWork
- Use raw parameterized SQL via `sql` template literal (NEVER string concatenation)
- Map DB rows to domain entities using the mapper

## Step 5: Wire in Infrastructure Module

```typescript
// infrastructure/user-infrastructure.module.ts
@Module({
  imports: [DatabaseModule],
  providers: [{ provide: WorkCenterRepositoryPort, useClass: WorkCenterRepository }],
  exports: [WorkCenterRepositoryPort],
})
export class UserInfrastructureModule {}
```

## Integration Testing (Functional Testing)

Test repositories with the real database using the NestJS testing module:

```typescript
// test/integration/user-profile/infrastructure/user-infrastructure.module.spec.ts
import { Test } from "@nestjs/testing";

import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";
import { UserInfrastructureModule } from "@/user-profile/infrastructure/user-infrastructure.module";

import { NoopDatabaseModuleMock } from "../../../__mocks__/noop-database-module";

describe("UserInfrastructureModule (without database connection)", () => {
  test("should be initialized with no dependency errors", async () => {
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

**Integration test rules**:

- Place in `test/integration/<bounded-context>/`
- Replace `DatabaseModule` with `NoopDatabaseModuleMock` for module wiring tests
- Use real DB (Testcontainers) for data access tests
- Mock external services only
- Never start a real HTTP server
