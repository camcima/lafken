# Documentation Standards

## README.md Requirements

Every app's README must include:

1. Application Overview
2. Architecture Overview
3. Technology Stack
4. Prerequisites
5. Development Environment Setup (clone, install, env vars, migrations)
6. Running Locally (dev mode, tests, lint)
7. Project Structure
8. Contributing
9. License
10. Links to `/docs` for deeper details

## Code Documentation

- **JSDoc/TSDoc** for public APIs, interfaces, and complex functions
- Document parameters, return types, and thrown exceptions
- Inline comments: minimal, focus on "why" not "what"
- Mark files excluded from coverage with `/* v8 ignore file */`

## API Documentation (OpenAPI/Swagger)

- **Code-first approach** using `@nestjs/swagger`
- Every controller: `@ApiTags("TagName")`
- Every route: `@ApiOperation({ summary, description })`
- Success/error responses: `@ApiResponse` with status, description, DTO schema
- DTOs are the Single Source of Truth for API shapes
- Expose endpoints:
  - Swagger UI: `/openapi`
  - JSON spec: `/openapi.json`
  - YAML spec: `/openapi.yaml`

## /docs Directory

- Architecture diagrams (Mermaid)
- ADRs (Architecture Decision Records)
- Referenced from README
- Keep in sync with implementation

## DTO Documentation

- Request DTOs: use `class-validator` + `@ApiProperty` decorators
- Response DTOs: use `@ApiProperty` decorators only (no validation)
- Deprecate with `deprecated: true` in `@ApiOperation` + RFC headers
