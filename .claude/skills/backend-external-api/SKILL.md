---
name: backend-external-api
description: Integrates with external HTTP APIs using the port, adapter, and client pattern. Covers the critical distinction between API Client classes (raw HTTP communication) and Adapter classes (domain translation), Axios interceptors for auth/logging/error handling, and testing strategies (E2E with port mocks, unit with client mocks). Use when integrating with external services, creating HTTP clients, or testing API integrations.
---

# External API Integrations

## Architecture: Port vs Adapter vs Client

When integrating with an external API, three distinct layers are involved:

```
application/services/
  random-title-generator.service.port.ts         → PORT (what the domain needs)

infrastructure/services/random-title-generator-http-client/
  json-placeholder-api.service.ts                → CLIENT (raw HTTP communication)
  random-title-generator.service.ts              → ADAPTER (implements port, uses client)
  random-title-generator-service.module.ts       → NestJS module wiring
```

### The Three Roles

| Layer       | Class                             | Responsibility                                                                                                                                     |
| ----------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Port**    | `RandomTitleGeneratorServicePort` | Defines WHAT the domain needs in domain language. No HTTP concepts.                                                                                |
| **Client**  | `JsonPlaceholderApiService`       | Low-level technical communication with the external API: making HTTP requests, handling authentication, managing headers, returning raw responses. |
| **Adapter** | `RandomTitleGeneratorService`     | Sits on top of the Client. Translates external API responses and data structures into the application's internal domain models and abstractions.   |

### Why Both Client AND Adapter?

A **Client** class is responsible for the low-level technical communication with the API -- making HTTP requests, handling authentication, managing headers, and returning raw responses. It maps 1:1 to the external API's endpoints (e.g., `getAllPosts()`, `getPostById()`).

An **Adapter** class sits on top of the Client and translates those external API responses and data structures into the application's internal domain models and abstractions, shielding the rest of the system from provider-specific details and allowing you to swap or change external services with minimal impact on business logic. It implements the domain port and may call multiple client methods, combine results, extract specific fields, or apply domain-specific transformations.

This separation means:

- If the external API changes its endpoints, authentication, or response format, only the **Client** changes
- If the domain's needs or internal models change, only the **Adapter** changes
- The Client can be reused if multiple adapters need the same external API
- You can swap the entire external provider by replacing the Client without touching the Adapter's translation logic (or swap both Client + Adapter without touching the Port)

---

## Step 1: Define the Port (Application Layer)

Defines WHAT the domain needs in domain language. No HTTP concepts:

```typescript
// application/services/random-title-generator.service.port.ts
export abstract class RandomTitleGeneratorServicePort {
  abstract generateRandomTitle(): Promise<string>;
}
```

## Step 2: Create the Client (Infrastructure Layer)

The Client handles raw HTTP communication. It maps to the external API's endpoints:

```typescript
// infrastructure/services/random-title-generator-http-client/json-placeholder-api.service.ts
import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";

import type { IJsonPlaceholderPostResponseDto } from "./json-placeholder-models/posts-api-models";

@Injectable()
export class JsonPlaceholderApiService {
  constructor(private readonly baseHttpClient: HttpService) {}

  async getAllPosts(): Promise<IJsonPlaceholderPostResponseDto[]> {
    // Can customize the HTTP client instance per operation if needed
    const httpClient = this.baseHttpClient.axiosRef.create({
      timeout: 10_000,
    });

    const response = await httpClient.get<IJsonPlaceholderPostResponseDto[]>("/posts");
    return response.data;
  }
}
```

**Client responsibilities** (low-level technical communication):

- Make HTTP requests to the external API (1:1 mapping with REST resources)
- Handle authentication (API keys, OAuth tokens, etc.)
- Manage headers, query params, request/response serialization
- Configure per-request timeouts, retries (e.g., via RxJS `retry()`)
- Return raw API responses as provider-specific DTOs
- **No business logic, no domain knowledge** -- purely technical HTTP communication

## Step 3: Create the Adapter (Infrastructure Layer)

The Adapter implements the port and uses the Client to translate between the external API and domain needs:

```typescript
// infrastructure/services/random-title-generator-http-client/random-title-generator.service.ts
import { Injectable } from "@nestjs/common";

import { RandomTitleGeneratorServicePort } from "@/user-profile/application/services/random-title-generator.service.port";

import { JsonPlaceholderApiService } from "./json-placeholder-api.service";

@Injectable()
export class RandomTitleGeneratorService implements RandomTitleGeneratorServicePort {
  constructor(private readonly jsonPlaceholderClient: JsonPlaceholderApiService) {}

  async generateRandomTitle(): Promise<string> {
    const allPosts = await this.jsonPlaceholderClient.getAllPosts();

    const randomPost = allPosts.at(Math.floor(Math.random() * allPosts.length));
    if (!randomPost) {
      throw new Error("No posts found");
    }

    return randomPost.title;
  }
}
```

**Adapter responsibilities** (domain translation layer):

- Implement the domain port (abstract class)
- Sit on top of the Client, calling one or more of its methods
- Translate external API responses and data structures into internal domain models
- Shield the rest of the system from provider-specific details
- Apply domain-specific logic (e.g., selecting a random item, combining data from multiple calls)
- Handle domain-level error cases (translate API errors into domain errors)
- Enable swapping external services with minimal impact on business logic

## Step 4: Module Wiring

```typescript
// infrastructure/services/random-title-generator-http-client/random-title-generator-service.module.ts
@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: () => ({
        baseURL: environmentConfiguration.TITLE_GENERATOR_API_BASE_URL,
        timeout: 60_000,
        headers: { Accept: "application/json" },
      }),
    }),
  ],
  providers: [JsonPlaceholderApiService, RandomTitleGeneratorService],
  exports: [RandomTitleGeneratorService],
})
export class RandomTitleGeneratorServiceModule {}
```

Bind in the bounded context's infrastructure module:

```typescript
@Module({
  imports: [RandomTitleGeneratorServiceModule],
  providers: [
    { provide: RandomTitleGeneratorServicePort, useExisting: RandomTitleGeneratorService },
  ],
  exports: [RandomTitleGeneratorServicePort],
})
export class UserInfrastructureModule {}
```

## Axios Interceptors

Apply interceptors to the HTTP client for cross-cutting concerns:

### Error Logger

```typescript
export function useErrorLoggerAxiosInterceptor(
  axiosClient: AxiosInstance,
  logger: AppLoggerPort,
): void {
  axiosClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError): Promise<never> => {
      logger.error(error.message, error?.stack);
      return Promise.reject(error);
    },
  );
}
```

### Replace Errors with Custom Exceptions

```typescript
export function useReplaceClientErrorWithException(
  axiosClient: AxiosInstance,
  exceptionFactory: (error: AxiosError) => Error,
): void {
  axiosClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (axios.isAxiosError(error)) {
        return Promise.reject(exceptionFactory(error));
      }
      throw error;
    },
  );
}
```

## Rules

- **Never leak** the HTTP client (Axios) outside the Client class
- **Never import** Axios types in domain/application layers
- **Client**: 1:1 mapping to external API endpoints, no business logic
- **Adapter**: implements domain port, contains transformation/business logic
- **All exceptions** from external API adapters should be custom error classes
- **Timeouts** must be configured per external service
- **Auth tokens** handled via interceptors (e.g., Google Auth for GCP services)

## Testing Strategy

### E2E Testing (Mock the Port)

In E2E tests, mock at the port level to avoid any external HTTP calls:

```typescript
const randomTitleMock = app.get<DeepMockProxy<RandomTitleGeneratorServicePort>>(
  RandomTitleGeneratorServicePort,
);
randomTitleMock.generateRandomTitle.mockResolvedValue("Mock Title");
```

### Unit Testing the Adapter (Mock the Client)

Test the adapter's business logic by mocking the Client class:

```typescript
import { mock } from "vitest-mock-extended";

describe("RandomTitleGeneratorService", () => {
  describe("#generateRandomTitle()", () => {
    it("should throw when client returns no posts", async () => {
      const clientMock = mock<JsonPlaceholderApiService>();
      clientMock.getAllPosts.mockResolvedValue([]);

      const adapter = new RandomTitleGeneratorService(clientMock);

      await expect(adapter.generateRandomTitle()).rejects.toThrow("No posts found");
    });

    it("should return a title from the client's posts", async () => {
      const clientMock = mock<JsonPlaceholderApiService>();
      clientMock.getAllPosts.mockResolvedValue([
        { id: 1, userId: 1, title: "Test Title", body: "Test Body" },
      ]);

      const adapter = new RandomTitleGeneratorService(clientMock);
      const title = await adapter.generateRandomTitle();

      expect(title).toEqual("Test Title");
    });
  });
});
```

### Unit Testing the Client (Mock Axios)

Test the client's HTTP communication by mocking Axios:

```typescript
import { HttpService } from "@nestjs/axios";
import { mock } from "vitest-mock-extended";

describe("JsonPlaceholderApiService", () => {
  it("should fetch all posts from the API", async () => {
    const httpServiceMock = mock<HttpService>();
    const axiosRefMock = {
      create: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          data: [{ id: 1, userId: 1, title: "Post", body: "Body" }],
        }),
      }),
    };
    httpServiceMock.axiosRef = axiosRefMock as any;

    const client = new JsonPlaceholderApiService(httpServiceMock);
    const posts = await client.getAllPosts();

    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe("Post");
  });
});
```
