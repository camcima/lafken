# Exception Handling Standards

## Exception Hierarchy

```
Error
  ├── DomainError          → 422 Unprocessable Entity (default)
  ├── ValidationError      → 400 Bad Request (default)
  └── ApplicationError     → 500 Internal Server Error (default)
```

### Domain Error (business rule violations)

```typescript
export abstract class DomainError extends Error {
  public readonly errorCode: string;
  public readonly params?: Record<string, unknown>;

  constructor(props: { message: string; params?: Record<string, unknown> }) {
    super(props.message);
    this.errorCode = this.constructor.name;
    this.name = this.constructor.name;
    this.params = props.params;
  }
}

// Concrete example
export class UserNotFoundError extends DomainError {
  constructor(props: { userEmailAddress: string }) {
    super({
      message: `User with email address "${props.userEmailAddress}" was not found`,
    });
  }
}
```

### Validation Error (input/constraint violations)

```typescript
export abstract class ValidationError extends Error {
  public readonly errorCode: string;
  public readonly params?: Record<string, unknown>;

  constructor(props: { message: string; params?: Record<string, unknown> }) {
    super(props.message);
    this.name = this.constructor.name;
    this.errorCode = this.constructor.name;
    this.params = props.params;
  }
}
```

## Error Mapping (Controller Layer ONLY)

Only the presentation layer is aware of HTTP status codes. Map domain errors to HTTP exceptions in controllers:

```typescript
@Controller("users")
class UserController {
  async getUserInfo(
    @Param() paramsDto: GetUserInfoPathParamsDTO,
  ): Promise<UserInformationResponseDTO> {
    try {
      const result = await this.retrieveUserInformationsUseCase.execute({
        userEmailAddress: paramsDto.user_email,
      });
      return UserResponseMapper.fromDomain(result.user);
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err; // rethrow unknown errors
    }
  }
}
```

## Global Exception Filter

The `CatchAllExceptionsForHttp` filter handles all unhandled exceptions and converts them to RFC 7807 Problem Details format. It handles:

- NestJS `HttpException` subclasses
- `DomainError` subclasses → 422
- `ValidationError` subclasses → 400
- Database errors → appropriate status
- Unknown errors → 500

## Rules

- **Never throw HTTP exceptions from domain/application layers** (framework coupling)
- **Domain/Application layers throw domain errors**; controllers map them to HTTP
- **Always use `throw err`** (not `throw new Error(...)`) when re-throwing to preserve stack
- **BE has additional filter**: `CatchBackendApiExceptionsForHttp` for Backend API errors
- Unknown exceptions get generic 500 response with no internal details exposed
