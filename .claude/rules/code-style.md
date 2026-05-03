# Code Style Guidelines

## TypeScript Conventions

- **Strict mode** enabled in all packages
- **No `any`** type unless absolutely necessary (and documented)
- Use `interface` over `type` for object shapes
- Use `import type` when importing only types (especially from `@shared/*`)
- Use path aliases (`@/`) consistently, never relative imports with `../../../`

## Naming Conventions

| Element           | Convention                                    | Example                   |
| ----------------- | --------------------------------------------- | ------------------------- |
| Files             | kebab-case                                    | `user-query.service.ts`   |
| Classes           | PascalCase                                    | `UserQueryService`        |
| Interfaces/Types  | PascalCase with `I` prefix for internal types | `IWorkCenterProps`        |
| Methods/Variables | camelCase                                     | `findByEmailAddress`      |
| Constants         | SCREAMING_SNAKE_CASE                          | `DATABASE_URL`            |
| DB columns        | snake_case                                    | `email_address`           |
| DB tables         | plural snake_case                             | `work_centers`            |
| Ports             | `*Port` suffix (abstract class)               | `UserQueryRepositoryPort` |
| Adapters          | Implementation name                           | `UserRepository`          |
| Use Cases         | `*UseCase` suffix                             | `RegisterUserUseCase`     |
| DTOs              | `*DTO` / `*ResponseDTO` suffix                | `RegisterNewUserDTO`      |
| Domain Errors     | `*Error` suffix                               | `UserNotFoundError`       |
| DB Schemas        | `*.db.ts` suffix                              | `work-center.db.ts`       |
| DB Mappers        | `*DbMapper` suffix                            | `WorkCenterDbMapper`      |
| Response Mappers  | `*ResponseMapper` suffix (static class)       | `UserResponseMapper`      |

## File Suffixes by Layer

| Layer                 | Suffix                      | Example                                  |
| --------------------- | --------------------------- | ---------------------------------------- |
| Domain Entity         | `.entity.ts`                | `user.entity.ts`                         |
| Value Object          | `.value-object.ts`          | `email.value-object.ts`                  |
| Domain Error          | `.error.ts`                 | `user-not-found.error.ts`                |
| Repository Port       | `.repository.port.ts`       | `user-query.repository.port.ts`          |
| Service Port          | `.service.port.ts`          | `random-title-generator.service.port.ts` |
| Use Case              | `.use-case.ts`              | `register-user.use-case.ts`              |
| Controller            | `.controller.ts`            | `user.controller.ts`                     |
| NestJS Module         | `.module.ts`                | `user-profile.module.ts`                 |
| Infrastructure Module | `-infrastructure.module.ts` | `user-infrastructure.module.ts`          |
| DB Schema             | `.db.ts`                    | `user.db.ts`                             |

## Configuration Standards (12-Factor App)

- All dynamic config via environment variables
- Load via Zod schema in `environment.configuration.ts`
- `.env` (git-ignored) for local dev, `.env.example` (committed) as template
- `.env` sections: `# APP`, `# DATABASE`, `# AUTH`, `# INTEGRATIONS`
- Use Node.js CLI `--env-file` flag (no `dotenv` lib in production)
- **Never access `process.env` directly** outside `environment.configuration.ts`

## Import Organization (Frontend)

```typescript
// 1. External packages
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

// 2. Internal aliases
import { Button } from "@/components/common/Button";
import { useWorkCenters } from "@/features/Admin/hooks/useWorkCenters";

// 3. Relative imports (only within same feature/module)
import { UserResponseMapper } from "../mappers/user-response.mapper";
```

- Direct imports only (no barrel files / re-exports)
- Never `import *`

## Composition over Inheritance

- Prefer function composition and dependency injection
- Use Strategy/Factory patterns for complex domain logic
- In React: children pattern, Slot pattern (Radix), compound components
- Use `cva` (class-variance-authority) for component variants
