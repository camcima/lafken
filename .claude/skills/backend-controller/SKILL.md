---
name: backend-controller
description: Implements NestJS controllers following hexagonal architecture with Swagger documentation and E2E testing. Covers controller structure, DTO validation, response mapping, error handling, and full HTTP flow E2E tests using supertest. Use when creating API endpoints, adding Swagger docs, or writing E2E tests.
---

# Backend Controller / Endpoint

## Controller Structure

```typescript
// presentation/controllers/user.controller.ts
import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

@Controller("users")
@ApiTags("User")
export class UserController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly retrieveUserInformationsUseCase: RetrieveUserInformationsUseCase,
  ) {}

  @Get(":user_email")
  @ApiOperation({ summary: "Get information about a given user" })
  @ApiOkResponse({ type: UserInformationResponseDTO })
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
      throw err;
    }
  }

  @Post()
  @ApiOperation({ summary: "Register a new user" })
  @ApiOkResponse({ type: NewlyRegisteredUserResponseDTO })
  async registerNewUser(
    @Body() bodyDto: RegisterNewUserDTO,
  ): Promise<NewlyRegisteredUserResponseDTO> {
    const result = await this.registerUserUseCase.execute({
      emailAddress: bodyDto.email,
      currentWorkCenterBaseName: bodyDto.currentBase,
    });
    return UserResponseMapper.fromRegisterUserUseCase(result);
  }
}
```

## Key Patterns

- **Decorators**: `@ApiTags` on class, `@ApiOperation` + `@ApiResponse` on each route
- **DTOs**: Request DTOs with validation, Response DTOs for output shapes
- **Response Mapper**: Static class mapping domain entities to response DTOs
- **Error handling**: Catch domain errors, map to HTTP exceptions in the controller only
- **No business logic** in controllers - delegate to use cases

## Response Mapper

```typescript
// presentation/mappers/user-response.mapper.ts
export class UserResponseMapper {
  static fromDomain(user: User): UserInformationResponseDTO {
    return {
      id: user.id,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      email: user.emailAddress,
      base: user.currentWorkCenter?.baseName,
    };
  }
}
```

## Module Wiring

```typescript
@Module({
  imports: [UserInfrastructureModule],
  providers: [RegisterUserUseCase, RetrieveUserInformationsUseCase],
  controllers: [UserController, WorkCenterController],
})
export class UserProfileModule {}
```

## E2E Testing

### File Location & Naming

```
test/e2e/<bounded-context>/presentation/<controller-name>/
  endpoint-<method-name>.e2e-spec.ts
```

### Test Structure

```typescript
import { type Server } from "http";

import { type NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";

describe("Register User - POST /v1/users", () => {
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

  describe("When the given input is valid", () => {
    test("and user does not exist, it should create and return the user", async () => {
      // #region [db-setup]
      await sql`INSERT INTO work_centers (base_name, location)
                VALUES ('SCL', 'Santiago')`.execute(db);
      // #endregion

      // #region [external-services-setup]
      const randomTitleMock = app.get<DeepMockProxy<RandomTitleGeneratorServicePort>>(
        RandomTitleGeneratorServicePort,
      );
      randomTitleMock.generateRandomTitle.mockResolvedValue("Random Title");
      // #endregion

      // Act
      const res = await request(underlyingHttpServer)
        .post("/v1/users")
        .send({ email: "test@example.com", currentBase: "SCL" });

      // Assert
      expect.soft(res.statusCode).toBe(HttpStatus.CREATED);
      expect.soft(res.type).toBe("application/json");
      expect.soft(res.body).toMatchObject({
        email: "test@example.com",
        base: "SCL",
      });

      // #region [db-checking]
      const dbUser =
        await sql`SELECT * FROM users WHERE email_address = 'test@example.com'`.execute(db);
      expect(dbUser.rows).toHaveLength(1);
      // #endregion

      // #region [db-cleanup]
      await sql`DELETE FROM users`.execute(db);
      await sql`DELETE FROM work_centers`.execute(db);
      // #endregion
    });
  });

  describe("When the given input is invalid", () => {
    test("and email is already taken, it should return 422", async () => {
      // ... setup existing user ...

      const res = await request(underlyingHttpServer)
        .post("/v1/users")
        .send({ email: "existing@example.com" });

      expect.soft(res.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect.soft(res.type).toBe("application/problem+json");
    });
  });
});
```

### E2E Test Rules

- **Use `supertest`** (NEVER `fetch` or `axios`)
- **Use `createAppModuleForE2ETest()`** to bootstrap the app
- **Organize with `#region` comments**: `[db-setup]`, `[external-services-setup]`, `[db-checking]`, `[db-cleanup]`
- **Follow AAA pattern**: Arrange-Act-Assert
- **Always verify**: both `statusCode` AND `type` (content-type)
- **Use `expect.soft()`** for multiple assertions
- **Mock external services** via `app.get<DeepMockProxy<Port>>(Port)`
- **Use factories** from `test/e2e/common/factories/` for test data (no hardcoded JSON)
- **Clean up database** in each test or `afterAll`
- **Never use `app.listen()`** - use `app.getHttpServer()` directly
- **One endpoint per test file**
