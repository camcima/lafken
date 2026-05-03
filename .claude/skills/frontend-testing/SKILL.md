---
name: frontend-testing
description: Implements frontend testing with Vitest and React Testing Library for unit/component tests, plus Playwright for E2E. Covers component testing patterns, hook mocking, QueryClient setup, and accessibility testing. Use when writing frontend tests, testing components, or setting up test infrastructure.
---

# Frontend Testing

## Tools

- **Vitest** - Test runner
- **React Testing Library** - Component testing
- **MSW** (Mock Service Worker) - API mocking
- **Playwright** - E2E tests (in `shared/web-tests/`)

## Commands

```bash
pnpm --filter web test          # Unit + component tests
pnpm --filter web test:cov      # Coverage report
```

## Component Testing

### Test Structure

```typescript
// features/Admin/components/WorkCenters.test.tsx
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider, type UseQueryResult } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { PaginatedWorkCenterResponseDTO } from "@shared/backend-api";
import WorkCenters from "./WorkCenters";
import { prefetchWorkCenters, useWorkCenters } from "@/features/Admin/hooks/useWorkCenters";

// Mock hooks at module level
vi.mock("@/features/Admin/hooks/useWorkCenters");
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === "admin.pagination.showing" && params) {
        return `Page ${params.page} of ${params.lastPage} (${params.total} total)`;
      }
      return key;
    },
  }),
}));

// Helper to wrap with QueryClient
function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("WorkCenters", () => {
  it("shows loading state", () => {
    vi.mocked(useWorkCenters).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isPlaceholderData: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<PaginatedWorkCenterResponseDTO>);

    renderWithQueryClient(<WorkCenters />);
    expect(screen.getByText("admin.loading")).toBeInTheDocument();
  });

  it("renders work centers data", () => {
    vi.mocked(useWorkCenters).mockReturnValue({
      data: {
        data: [{ id: "1", name: "Work Center 1" }],
        page: 1, lastPage: 1, total: 1,
      },
      isLoading: false, error: null, isPlaceholderData: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<PaginatedWorkCenterResponseDTO>);

    renderWithQueryClient(<WorkCenters />);
    expect(screen.getByText("Work Center 1")).toBeInTheDocument();
  });

  it("prefetches next page when available", () => {
    vi.mocked(useWorkCenters).mockReturnValue({
      data: {
        data: [{ id: "1", name: "WC1" }],
        page: 1, lastPage: 2, total: 2,
      },
      isLoading: false, error: null, isPlaceholderData: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<PaginatedWorkCenterResponseDTO>);

    renderWithQueryClient(<WorkCenters />);
    expect(prefetchWorkCenters).toHaveBeenCalledWith({ page: 2 });
  });
});
```

## Testing Patterns

### QueryClient Wrapper

Always create a fresh `QueryClient` for each test:

```typescript
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}
```

### Mocking Hooks

```typescript
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "1", email: "test@test.com", roles: ["admin"] },
    isAuthenticated: true,
    isLoading: false,
  }),
  useHasRole: (roles: string[]) => roles.includes("admin"),
}));
```

### MSW for API Mocking

```typescript
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const handlers = [
  http.get("/v1/users/self", () => {
    return HttpResponse.json({
      id: "1",
      email: "test@test.com",
      base: "SCL",
    });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Storybook

Required for reusable components in `src/components/common/`. Colocate stories with components:

```typescript
// components/common/Button/Button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./index";

const meta: Meta<typeof Button> = {
  title: "Components/UI/Button",
  component: Button,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { children: "Button" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Delete" } };
```

## Coverage Target

- **80% minimum** coverage
- Focus on: user interactions, loading/error/success states, conditional rendering

## Rules

- **Mock hooks, not implementations** - mock at the boundary (`vi.mock`)
- **Fresh QueryClient** per test - prevent test pollution
- **Test user behavior** - not implementation details
- **Always test**: loading, error, empty, and success states
- **Use `screen.getByText/getByRole`** - prefer accessible queries
- **Colocate test files** with components (`*.test.tsx`)
