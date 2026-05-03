# API Design Standards (REST)

## Resource Naming

- Use **plural nouns** for collections: `/users`, `/work-centers`
- Use **kebab-case** for multi-word resources: `/work-centers` (not `/workCenters`)
- Resources represent entities, not actions: `/users` (not `/getUsers`)

## HTTP Methods

| Method   | Purpose              | Status Code    |
| -------- | -------------------- | -------------- |
| `GET`    | Retrieve resource(s) | 200 OK         |
| `POST`   | Create resource      | 201 Created    |
| `PUT`    | Full replace         | 200 OK         |
| `PATCH`  | Partial update       | 200 OK         |
| `DELETE` | Remove resource      | 204 No Content |

Error responses: 400, 404, 422, 500 (always RFC 7807 format).

## API Versioning

Use NestJS versioning feature for non-default versions:

```typescript
// GOOD - NestJS versioning
@Controller({ path: "pcp-users", version: "2" })
export class PcpUserController {}

// BAD - Hardcoded version in path
@Controller("v2/pcp-users")  // NEVER do this
```

- Default version is abstract from controller definition
- **Never change the default version**

## Request/Response DTOs

- Request DTOs: `*DTO` suffix with `class-validator` decorators
- Response DTOs: `*ResponseDTO` suffix (no validation decorators)
- DTOs live in `@shared/backend-api` (Single Source of Truth)
- FE imports Backend DTOs with `import type` only

```typescript
// Request DTO with validation
export class RegisterNewUserDTO {
  @IsEmail()
  @ApiProperty()
  email: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ required: false, type: String })
  currentBase?: string;
}

// Response DTO (no validation decorators)
export class UserInformationResponseDTO {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;
}
```

## Pagination

Use `makePaginatedRequestInputDto()` and `makePaginatedResponseDto()` factory functions from `@shared/backend-api`:

```typescript
export class GetWorkCentersPaginatedQueryDTO extends makePaginatedRequestInputDto() {
  @IsIn(["createdAt"], { each: true })
  @ApiProperty({ enum: ["createdAt"], default: ["createdAt"] })
  orderBy: "createdAt"[] = ["createdAt"];
}

export class PaginatedWorkCenterResponseDTO extends makePaginatedResponseDto(
  WorkCenterResponseDTO,
) {}
```

## Authentication

- **Backend handles user authentication** via `@AuthenticatedEndpoint()` decorator
- Role-based access via `@EndpointRequiredRoles(["role_name"])`

## API Deprecation (RFC 9745 + RFC 8594)

```typescript
@Get('foo')
@Header("Deprecation", "@1688169599")              // RFC 9745 (Unix epoch)
@Header("Sunset", "Sun, 30 Jun 2024 23:59:59 UTC") // RFC 8594 (HTTP date)
@ApiOperation({ summary: "List foos", deprecated: true })
async getFoo() {}
```
