---
name: frontend-authentication
description: Implements frontend authentication with the IAuthProvider interface, AuthProviderFactory (MSAL/Mock), AuthContext, AuthGuard/AuthMonitoredGuard, and useAuth hook. Covers login/logout flows, token injection, role/group-based access control, and testing with MockAuthAdapter. Use when adding auth features, protecting routes, or testing authenticated flows.
---

# Frontend Authentication

## Architecture

```
lib/auth/
  interface/IAuthProvider.ts    → Auth provider contract
  adapters/
    MsalAuthAdapter.ts          → Azure AD (MSAL) implementation
    MockAuthAdapter.ts          → Mock implementation for dev/test
  AuthProviderFactory.ts        → Singleton factory (selects adapter by config)
contexts/AuthContext.tsx         → React context (login, logout, getAccessToken, user)
hooks/useAuth.ts                → Hook + helpers (useHasRole, useHasGroup, usePermissions)
features/User/components/
  AuthGuard/index.tsx            → Route protection component + HOC
components/withMonitoring/
  index.tsx                      → HOC that initializes Faro after auth
```

## IAuthProvider Interface

```typescript
// lib/auth/interface/IAuthProvider.ts
interface IAuthProvider {
  initialize(): Promise<void>;
  login(options?: LoginOptions): Promise<void>;
  logout(options?: LogoutOptions): Promise<void>;
  getUser(): Promise<AuthUser | null>;
  isAuthenticated(): Promise<boolean>;
  getAccessToken(options?: TokenOptions): Promise<string | null>;
  handleRedirectCallback(): Promise<void>;
  getProviderName(): string;
  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void;
}

interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  roles?: string[];
  groups?: string[];
  claims?: Record<string, unknown>;
  raw?: unknown;
}
```

## AuthProviderFactory

```typescript
// lib/auth/AuthProviderFactory.ts
import { getRuntimeValue } from "@/config/app-config";
// "msal" | "mock"

// Usage
import { getAuthProvider } from "@/lib/auth/AuthProviderFactory";

// Singleton - created once, reused across the app
const provider = getRuntimeValue("AUTH_PROVIDER");

const authProvider = await getAuthProvider();
```

- `AUTH_PROVIDER=msal` → Azure AD via `@azure/msal-browser` + `@azure/msal-react`
- `AUTH_PROVIDER=mock` → Returns a fake user with configurable roles (for dev/test)

## AuthContext

```typescript
// contexts/AuthContext.tsx
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialization sequence (order matters):
  // 1. authProvider.initialize()
  // 2. authProvider.handleRedirectCallback()
  // 3. authProvider.getUser()
  // 4. authProvider.onAuthStateChanged(callback)
}

// Exposed via context:
interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  whenReady: () => Promise<void>; // Wait for auth init to complete
  login: (redirectPath?: string) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null | undefined>;
}
```

## useAuth Hook

```typescript
import { useAuth } from "@/hooks/useAuth";

function MyComponent() {
  const { user, isAuthenticated, isLoading, login, logout, getAccessToken } = useAuth();
}
```

### Helper Hooks

```typescript
import { useHasGroup, useHasRole, usePermissions } from "@/hooks/useAuth";

// Check single/multiple roles
const isAdmin = useHasRole(["admin"]);

// Check group membership
const isInGroup = useHasGroup(["maintenance-team"]);

// Combined permissions
const { roles, groups, hasPermission } = usePermissions();
```

## Route Protection

### AuthGuard Component (preferred)

```typescript
import AuthMonitoredGuard from "@/features/User/components/AuthGuard";

// In a page component
export default function AdminPage() {
  return (
    <AuthMonitoredGuard
      requiredRoles={["admin"]}
      unauthorizedComponent={UnauthorizedAdmin}
    >
      <MainLayout>
        {/* Protected content */}
      </MainLayout>
    </AuthMonitoredGuard>
  );
}
```

**Props:**

| Prop                    | Type            | Default           | Description                             |
| ----------------------- | --------------- | ----------------- | --------------------------------------- |
| `children`              | `ReactNode`     | —                 | Protected content                       |
| `requiredRoles`         | `string[]`      | `[]`              | Roles user must have (OR logic)         |
| `requiredGroups`        | `string[]`      | `[]`              | Groups user must belong to (OR logic)   |
| `fallbackPath`          | `string`        | `"/auth/login"`   | Redirect path for unauthenticated users |
| `unauthorizedComponent` | `ComponentType` | Built-in fallback | Custom UI for unauthorized users        |

### AuthMonitoredGuard vs AuthGuard

- `AuthMonitoredGuard` = `withMonitoring(AuthGuard)` — initializes Grafana Faro on auth
- Use `AuthMonitoredGuard` (the default export) for page-level guards
- Use raw `AuthGuard` only if monitoring is handled elsewhere

### HOC Alternative

```typescript
import { withAuthGuard } from "@/features/User/components/AuthGuard";

const ProtectedComponent = withAuthGuard(MyComponent, { requiredRoles: ["admin"] });
```

## Token Injection in API Client

```typescript
// lib/api/client.ts
// The API client automatically injects the Bearer token via getAccessToken()
// before each request. No manual token handling needed in service classes.
```

## Testing

### Mock Auth Provider

Set `AUTH_PROVIDER=mock` in test setup (`vitest.setup.ts` already does this):

```typescript
sessionStorage.setItem("AUTH_PROVIDER", "mock");
```

### Testing with AuthContext

```typescript
import AuthProvider from "@/contexts/AuthContext";

function renderWithAuth(ui: ReactElement) {
  return render(
    <QueryClientProvider client={testQueryClient}>
      <AuthProvider>{ui}</AuthProvider>
    </QueryClientProvider>
  );
}
```

### Resetting Auth State

```typescript
import { resetAuthProvider } from "@/lib/auth/AuthProviderFactory";

afterEach(() => {
  resetAuthProvider(); // Clear singleton for test isolation
});
```

## Rules

- **Never access MSAL directly** — always go through `IAuthProvider` interface
- **Never store tokens** in state or localStorage — use `getAccessToken()` on demand
- **Auth events must be logged** via `logger.auth()` (login, logout, token, access denied)
- **Always provide `unauthorizedComponent`** for role-protected pages (don't rely on the default fallback)
- **Redirect path preservation**: `login()` accepts optional `redirectPath` stored in sessionStorage
