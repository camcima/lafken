---
name: backend-service
description: Implements application services (use cases) following hexagonal architecture. Covers use case structure, transaction management with UnitOfWork, domain event publishing, and testing strategies (unit with mocks, functional with real dependencies). Use when creating business logic, orchestrating domain operations, or writing use case tests.
---

# Backend Services & Use Cases

## Use Case Structure

```typescript
// application/use-cases/register-user.use-case.ts
import { Injectable } from "@nestjs/common";

import { DomainEventPublisherPort } from "@/shared/application/events/domain-event-publisher.port";
import { UnitOfWorkPort } from "@/shared/application/unit-of-work.port";

@Injectable()
export class RegisterUserUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly domainEventPublisher: DomainEventPublisherPort,
    private readonly userQueryRepository: UserQueryRepositoryPort,
    private readonly userCommandRepository: UserCommandRepositoryPort,
    private readonly workCenterRepository: WorkCenterRepositoryPort,
    private readonly randomTitleGeneratorService: RandomTitleGeneratorServicePort,
  ) {}

  async execute(input: {
    emailAddress: string;
    currentWorkCenterBaseName?: string;
  }): Promise<{ user: User; randomTitle: string }> {
    // 1. Validate business rules
    const existingUser = await this.userQueryRepository.findByEmailAddress(input.emailAddress);
    if (existingUser) {
      throw new UserEmailTakenError({ emailAddress: input.emailAddress });
    }

    // 2. Resolve dependencies
    let workCenter: WorkCenter | undefined;
    if (input.currentWorkCenterBaseName) {
      workCenter = await this.workCenterRepository.findByBaseName(input.currentWorkCenterBaseName);
      if (!workCenter) {
        throw new WorkCenterNotFoundError({ workCenterBaseName: input.currentWorkCenterBaseName });
      }
    }

    // 3. Execute in transaction
    const { savedUser, randomTitle } = await this.unitOfWork.execute(async () => {
      const newUser = User.makeNew({
        emailAddress: input.emailAddress,
        currentWorkCenter: workCenter,
      });

      const savedUser = await this.userCommandRepository.saveNew(newUser);
      const randomTitle = await this.randomTitleGeneratorService.generateRandomTitle();

      // 4. Publish domain events
      await this.domainEventPublisher.publish(
        new NewUserRegisteredEvent({ user: savedUser, timestamp: new Date() }),
      );

      return { savedUser, randomTitle };
    });

    return { user: savedUser, randomTitle };
  }
}
```

## Key Patterns

- **Dependencies via constructor injection** using ports (abstract classes)
- **UnitOfWorkPort** wraps transactional operations
- **Domain errors** thrown for business rule violations (not HTTP exceptions)
- **Domain events** published within the transaction boundary
- **Entity factory methods** (`User.makeNew()`) for creating new entities

## Application Service Ports

```typescript
// application/services/random-title-generator.service.port.ts
export abstract class RandomTitleGeneratorServicePort {
  abstract generateRandomTitle(): Promise<string>;
}
```

Implemented by an adapter in `infrastructure/services/`.

## Unit Testing (with mocks)

```typescript
// test/unit/user-profile/application/use-cases/register-user.use-case.spec.ts
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

describe("RegisterUserUseCase", () => {
  let useCase: RegisterUserUseCase;
  let unitOfWorkMock: ReturnType<typeof mock<UnitOfWorkPort>>;
  let userQueryRepositoryMock: ReturnType<typeof mock<UserQueryRepositoryPort>>;
  let userCommandRepositoryMock: ReturnType<typeof mock<UserCommandRepositoryPort>>;

  beforeEach(() => {
    unitOfWorkMock = mock<UnitOfWorkPort>();
    userQueryRepositoryMock = mock<UserQueryRepositoryPort>();
    userCommandRepositoryMock = mock<UserCommandRepositoryPort>();

    // Make UnitOfWork execute the callback
    unitOfWorkMock.execute.mockImplementation(async (callback) => callback());

    useCase = new RegisterUserUseCase(
      unitOfWorkMock,
      mock<DomainEventPublisherPort>(),
      userQueryRepositoryMock,
      userCommandRepositoryMock,
      mock<WorkCenterRepositoryPort>(),
      mock<RandomTitleGeneratorServicePort>(),
    );
  });

  it("should throw UserEmailTakenError when user already exists", async () => {
    userQueryRepositoryMock.findByEmailAddress.mockResolvedValue(mock<User>());

    await expect(useCase.execute({ emailAddress: "existing@example.com" })).rejects.toThrow(
      UserEmailTakenError,
    );

    expect(unitOfWorkMock.execute).not.toHaveBeenCalled();
  });

  it("should register user successfully", async () => {
    const savedUser = mock<User>({ id: "user-123", emailAddress: "new@example.com" });
    userQueryRepositoryMock.findByEmailAddress.mockResolvedValue(null);
    userCommandRepositoryMock.saveNew.mockResolvedValue(savedUser);

    vi.spyOn(User, "makeNew").mockReturnValue(mock<User>());

    const result = await useCase.execute({ emailAddress: "new@example.com" });

    expect(result.user).toEqual(savedUser);
    expect(userCommandRepositoryMock.saveNew).toHaveBeenCalled();
  });
});
```

**Unit test rules**:

- Mock ALL dependencies using `vitest-mock-extended`
- Test one use case per file
- Test both success and error paths
- Verify domain errors are thrown for business rule violations
- Place in `test/unit/<bounded-context>/application/use-cases/`

## Functional Testing (with real dependencies)

Integration tests verify use cases work with real repository implementations:

```typescript
// test/integration/<bounded-context>/application/use-cases/register-user.use-case.spec.ts
describe("RegisterUserUseCase (Integration)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [UserInfrastructureModule /* ... */],
    })
      .overrideModule(DatabaseModule)
      .useModule(NoopDatabaseModuleMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  // Test use case with mocked external services but real internal wiring
});
```
