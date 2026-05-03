# API Error Messages - RFC 7807 Problem Details

All HTTP error responses MUST use the RFC 7807 Problem Details format with content type `application/problem+json`.

## Response Format

```json
{
  "type": "about:blank",
  "title": "Unprocessable Entity",
  "status": 422,
  "detail": "User with email address \"john@example.com\" was not found"
}
```

## Implementation

The `CatchAllExceptionsForHttp` global filter automatically converts exceptions:

```typescript
// Registered globally in AppModule
@Module({
  providers: [{ provide: APP_FILTER, useClass: CatchAllExceptionsForHttp }],
})
export class AppModule {}
```

### Automatic Mapping

| Exception Type         | HTTP Status        | `title`                   |
| ---------------------- | ------------------ | ------------------------- |
| `DomainError`          | 422                | `"Unprocessable Entity"`  |
| `ValidationError`      | 400                | `"Bad Request"`           |
| NestJS `HttpException` | Exception's status | HTTP status text          |
| Database errors        | 500                | `"Internal Server Error"` |
| Unknown errors         | 500                | `"Internal Server Error"` |

### Custom Status Mapping (in Controllers)

When a domain error needs a different HTTP status, catch and re-throw as an HTTP exception:

```typescript
try {
  return await this.useCase.execute(input);
} catch (err) {
  if (err instanceof UserNotFoundError) {
    throw new NotFoundException(err.message, { cause: err });
  }
  throw err;
}
```

## OpenAPI Documentation for Errors

Use `application/problem+json` content type in Swagger decorators:

```typescript
@ApiNotFoundResponse({
  content: {
    "application/problem+json": {
      schema: {
        $ref: getSchemaPath(UserNotFoundErrorResponseDTO),
      },
    },
  },
})
```

## Backend Error Forwarding

The BE has `CatchBackendApiExceptionsForHttp` to forward Backend API errors as Problem Details to the frontend, preserving the original error structure.
