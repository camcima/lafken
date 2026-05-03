---
name: frontend-routing
description: Configures TanStack Router with file-based routing, type-safe navigation, search params validation with Zod, and protected routes with auth guards. Use when creating new pages/routes, adding navigation, or implementing auth-protected routes.
---

# Frontend Routing (TanStack Router)

## File-Based Routing

Routes are defined by file structure in `src/routes/`:

```
src/routes/
  __root.tsx              → Root layout (providers, error boundary)
  index.tsx               → / (home/dashboard)
  auth/
    login.tsx             → /auth/login
  admin/
    users.tsx             → /admin/users
```

## Root Route

```typescript
// routes/__root.tsx
import { createRootRouteWithContext, Outlet, ScrollRestoration } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { Provider } from "@/contexts/RootProvider";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <Provider queryClient={Route.useRouteContext().queryClient}>
      <ScrollRestoration />
      <Outlet />
    </Provider>
  ),
});
```

## Page Routes

### Basic Page

```typescript
// routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";

import DashboardPage from "@/features/Dashboard/routes/DashboardPage";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});
```

### With Search Params (Zod validation)

```typescript
// routes/admin/users.tsx
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  page: z.number().optional().default(1),
  search: z.string().optional(),
});

export const Route = createFileRoute("/admin/users")({
  validateSearch: searchSchema,
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { page, search } = Route.useSearch();
  const navigate = Route.useNavigate();

  const goToPage = (newPage: number) => {
    navigate({ search: (prev) => ({ ...prev, page: newPage }) });
  };
}
```

### Protected Route (Auth Guard)

```typescript
// routes/admin/users.tsx
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/users")({
  beforeLoad: async ({ context }) => {
    const auth = context.auth;
    if (!auth.isAuthenticated) {
      throw redirect({ to: "/auth/login", search: { redirect: "/admin/users" } });
    }
  },
  component: AdminUsersPage,
});
```

## Navigation

### Link Component (preferred)

```typescript
import { Link } from "@tanstack/react-router";

<Link to="/" className="text-white" activeProps={{ className: "border-b-1 border-white" }}>
  Dashboard
</Link>

<Link to="/admin/users" search={{ page: 1 }}>
  Users
</Link>
```

### Programmatic Navigation

```typescript
import { useNavigate } from "@tanstack/react-router";

const navigate = useNavigate();
navigate({ to: "/admin/users", search: { page: 2 } });
```

## Rules

- **Use `Link` component** or `useNavigate` - never manual `href` or `window.location`
- **Validate search params** with Zod `validateSearch`
- **Type-safe routes** via `createFileRoute`
- **Auth guards** in `beforeLoad` - redirect to login with return path
- **URL is the source of truth** for pagination, filters, search state
