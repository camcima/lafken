---
name: backend-documentation
description: Generates and maintains API documentation using Swagger/OpenAPI and project documentation in README and /docs. Covers code-first OpenAPI setup with @nestjs/swagger, DTO documentation, Swagger UI configuration, and the /docs directory structure for ADRs and architecture diagrams. Use when setting up Swagger, documenting endpoints, writing README, or creating architecture docs.
---

# Backend Documentation

## Swagger / OpenAPI (Code-First)

### Library

`@nestjs/swagger` - generates OpenAPI spec from code decorators.

### Endpoints

| Path            | Content    |
| --------------- | ---------- |
| `/openapi`      | Swagger UI |
| `/openapi.json` | JSON spec  |
| `/openapi.yaml` | YAML spec  |

### Controller Annotations

Every controller and route MUST have Swagger decorators:

```typescript
@Controller("users")
@ApiTags("User") // Required on every controller
export class UserController {
  @Get(":user_email")
  @ApiOperation({ summary: "Get user information" }) // Required on every route
  @ApiOkResponse({ type: UserInformationResponseDTO })
  @ApiNotFoundResponse({
    content: {
      "application/problem+json": {
        schema: { $ref: getSchemaPath(UserNotFoundErrorResponseDTO) },
      },
    },
  })
  async getUserInfo(@Param() params: GetUserInfoPathParamsDTO) {}
}
```

### DTO Documentation

DTOs are the **Single Source of Truth** for API shapes:

```typescript
// Request DTO - includes validation decorators
export class RegisterNewUserDTO {
  @IsEmail()
  @ApiProperty({ description: "User email address" })
  email: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ required: false, type: String, description: "Work center base name" })
  currentBase?: string;
}

// Response DTO - only @ApiProperty decorators
export class UserInformationResponseDTO {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ required: false, type: String })
  base?: string;
}
```

### Deprecation in Swagger

```typescript
@ApiOperation({
  summary: "List foos",
  deprecated: true,                              // Mark as deprecated
  description: "Use GET /v2/foos instead.",      // Point to replacement
})
```

### Error Responses

Use `application/problem+json` content type:

```typescript
@ApiNotFoundResponse({
  content: {
    "application/problem+json": {
      schema: { $ref: getSchemaPath(NotFoundErrorDTO) },
    },
  },
})
```

## README.md Structure

```markdown
# App Name

## Overview

Brief description of the application.

## Architecture Overview

High-level architecture description. Link to diagrams in /docs.

## Technology Stack

- NestJS, Kysely, PostgreSQL, etc.

## Prerequisites

- Node.js, pnpm, Docker, etc.

## Development Setup

1. Clone repo
2. Install dependencies: `pnpm install`
3. Copy env: `cp .env.example .env`
4. Run migrations: `pnpm migrate`
5. Start dev: `pnpm dev`

## Running Tests

- `pnpm test` - All tests
- `pnpm test:e2e` - E2E tests
- `pnpm lint` - Linting

## Project Structure

Brief folder structure explanation.

## Contributing

Contribution guidelines.

## Links

- [Architecture Docs](/docs)
- [API Documentation](/openapi)
```

## /docs Directory

```
docs/
  architecture/
    overview.md           # System architecture diagram (Mermaid)
    hexagonal.md          # Hexagonal architecture explanation
  adr/
    001-use-kysely.md     # Architecture Decision Records
    002-use-uuidv7.md
  diagrams/
    sequence-*.md         # Sequence diagrams (Mermaid)
```

### ADR Format

```markdown
# ADR-001: Use Kysely for Database Access

## Status

Accepted

## Context

We need a type-safe database query builder...

## Decision

Use Kysely with raw parameterized SQL...

## Consequences

- Type-safe SQL queries
- No ORM abstraction overhead
- Requires manual migration management
```

## Code Documentation

- **JSDoc/TSDoc** for public APIs and complex functions
- **Inline comments**: minimal, focus on "why" not "what"
- **Mark test exclusions**: `/* v8 ignore file */` for files excluded from coverage
