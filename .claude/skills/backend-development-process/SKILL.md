---
name: backend-development-process
description: Guides the full backend feature development workflow from database migration through deployment. Covers trunk-based development, TDD, the sequential build order (db -> repo -> service -> controller), and the quality gate pipeline (lint, type-check, tests, commit, push, merge request). Use when starting a new backend feature, creating a branch, or following the development lifecycle.
---

# Backend Development Process

## Trunk-Based Development

1. Create a short-lived feature branch from `master`:
   ```bash
   git checkout master && git pull
   git checkout -b feat/<ticket-id>-<short-description>
   ```
2. Make small, focused commits following Conventional Commits
3. Push and open a Merge Request in GitLab targeting `master`
4. Merge after CI passes and code review approval

## Sequential Build Order (MANDATORY)

Build features in this exact order. Each step depends on the previous:

### Step 1: Database Migration

Create the migration file, write `up` and `down` sections, run it.

```bash
pnpm --filter backend migrate:new <migration-name>
# Edit the generated file in apps/backend/db/migrations/
pnpm --filter backend migrate
```

### Step 2: Repository + Domain Contracts

1. Define the **domain entity** in `domain/entities/`
2. Define the **repository port** (abstract class) in `domain/repositories/`
3. Define DB schema types in `infrastructure/persistence/schemas/*.db.ts`
4. Implement DB mapper in `infrastructure/persistence/mappers/`
5. Implement repository adapter in `infrastructure/persistence/repositories/`

### Step 3: Domain Model & DTOs

1. Add/update entities, value objects, domain errors in `domain/`
2. Define shared DTOs in `@shared/backend-api` (Single Source of Truth)

### Step 4: Integration Tests

Write integration tests for repositories and services:

```bash
pnpm --filter backend test:intg
```

### Step 5: Application Services (Use Cases)

Implement use cases in `application/use-cases/`. Use repository ports, UnitOfWorkPort for transactions.

### Step 6: Controllers & Endpoints

1. Create controller in `presentation/controllers/`
2. Add Swagger decorators: `@ApiTags`, `@ApiOperation`, `@ApiResponse`
3. Add response mapper in `presentation/mappers/`
4. Wire in the module file

### Step 7: E2E Tests

Write full HTTP flow tests:

```bash
pnpm --filter backend test:e2e
```

### Step 8: Quality Gate (before commit)

```bash
pnpm --filter backend test          # All tests
pnpm --filter backend dep-check     # Hexagonal boundary verification
pnpm --filter backend lint           # ESLint
pnpm --filter backend type-check    # TypeScript strict
```

## TDD Approach

For each layer, write the test BEFORE the implementation:

1. **Red**: Write a failing test that describes the expected behavior
2. **Green**: Write the minimum code to make the test pass
3. **Refactor**: Clean up while keeping tests green

## Commit & Push Flow

```bash
# After all quality gates pass:
git add <specific-files>
git commit -m "feat(user-profile): add register user endpoint"
git push -u origin feat/<ticket-id>-<short-description>

# Open Merge Request in GitLab
```

See the [backend-git-commit](../backend-git-commit/SKILL.md) skill for commit message conventions.
