---
name: frontend-data-fetching
description: Implements data fetching with TanStack Query (React Query), service classes with Inversify DI, and the API client. Covers query key factories, custom hooks, prefetching, optimistic updates, and cache invalidation. Use when creating API integrations, data fetching hooks, or managing server state.
---

# Frontend Data Fetching

## Architecture

```
lib/api/client.ts          → API client (fetch + auth + validation)
services/index.ts          → Inversify DI container (singletons)
features/*/services/       → Service classes (API endpoints)
features/*/hooks/          → React Query hooks
lib/api/query-client.ts    → QueryClient configuration
```

## API Client

The `apiClient` handles auth token injection, error handling, and response validation:

```typescript
import { apiClient } from "@/lib/api/client";

// GET with optional Zod validation
const data = await apiClient.get<User>("/v1/users/me", { schema: userSchema });

// POST with response validation
const created = await apiClient.post<CreateUserDTO, User>("/v1/users", payload, {
  schema: userResponseSchema,
});
```

## Service Classes

Service classes wrap API endpoints and are registered as singletons via Inversify:

```typescript
// features/User/services/UserService.ts
import type { UserInformationResponseDTO } from "@shared/backend-api";
import { injectable } from "inversify";
// services/index.ts - DI container
import { Container } from "inversify";

import { apiClient } from "@/lib/api/client";

@injectable()
export class UserService {
  async getUserInfo(signal?: AbortSignal): Promise<UserInformationResponseDTO> {
    return apiClient.get<UserInformationResponseDTO>("/v1/users/self", { signal });
  }

  async registerUser(data: RegisterUserDTO, signal?: AbortSignal) {
    return apiClient.post("/v1/users", data, { signal });
  }
}

const container = new Container();
container.bind(UserService).toSelf().inSingletonScope();
export const userService = container.get(UserService);
```

## React Query Hooks

### Query Key Factory

```typescript
// features/Admin/hooks/useWorkCenters.ts
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { queryClient } from "@/lib/api/query-client";
import { workCenterService } from "@/services";

const workCenterKeys = {
  all: ["workCenters"] as const,
  lists: () => [...workCenterKeys.all, "list"] as const,
  list: (params: { page: number }) => [...workCenterKeys.lists(), params] as const,
};

export function useWorkCenters({ page }: { page: number }) {
  return useQuery({
    queryKey: workCenterKeys.list({ page }),
    queryFn: ({ signal }) =>
      workCenterService.getWorkCenters(
        {
          page,
          limit: 10,
          order: ["desc"],
          orderBy: ["createdAt"],
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  });
}

export function prefetchWorkCenters({ page }: { page: number }) {
  return queryClient.prefetchQuery({
    queryKey: workCenterKeys.list({ page }),
    queryFn: () =>
      workCenterService.getWorkCenters({
        page,
        limit: 10,
        order: ["desc"],
        orderBy: ["createdAt"],
      }),
  });
}
```

### Patterns

| Pattern            | Use Case                                 |
| ------------------ | ---------------------------------------- |
| `useQuery`         | Single data fetch                        |
| `useQueries`       | Parallel independent queries             |
| `useMutation`      | Create/update/delete operations          |
| `keepPreviousData` | Pagination (keep old data while loading) |
| `enabled`          | Dependent/conditional queries            |
| `prefetchQuery`    | Prefetch next page or likely-needed data |

### Optimistic Updates

```typescript
const mutation = useMutation({
  mutationFn: (data) => userService.registerUser(data),
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: userKeys.all });
    const previous = queryClient.getQueryData(userKeys.all);
    queryClient.setQueryData(userKeys.all, (old) => [...old, newData]);
    return { previous };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(userKeys.all, context?.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: userKeys.all });
  },
});
```

## QueryClient Configuration

```typescript
// lib/api/query-client.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

## Rules

- **AbortSignal**: Always pass `signal` from `queryFn` to service methods
- **Query keys**: Use hierarchical factory pattern for consistent cache management
- **Never store server state** in Zustand or Context (use React Query)
- **Import types only** from `@shared/backend-api` (use `import type`)
- **Error handling**: React Query provides `error` object; show with `toast.error()`
