---
name: frontend-state-management
description: Implements client-side state management with Zustand (slices, immer, persist, devtools) and the three-tier state strategy. Covers store creation, slice patterns, middleware composition, and when to use URL state vs server state vs UI state. Use when managing UI state, user preferences, or adding new store slices.
---

# Frontend State Management

## Three-Tier State Strategy

| Tier                             | Tool                           | Use For                                      | Example                      |
| -------------------------------- | ------------------------------ | -------------------------------------------- | ---------------------------- |
| **URL State** (highest priority) | TanStack Router `searchParams` | Pagination, filters, search, shareable state | `?page=2&search=foo`         |
| **Server State**                 | TanStack Query                 | API data, cached resources                   | User list, work centers      |
| **UI State** (lowest priority)   | Zustand                        | User preferences, theme, transient UI state  | Theme, language, date format |

**Rule**: Never store server data in Zustand. Never store shareable state outside the URL.

## Store Architecture

```
src/stores/
  index.ts                        → Store creation with middleware
  slices/
    user-preferences-slice.ts     → Slice definition
  listeners/
    user-preferences-listener.ts  → Side-effect subscriptions
```

## Store Creation (Middleware Composition)

```typescript
// src/stores/index.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { persist } from "zustand/middleware";
import { subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export const useAppStore = create<Store & StoreActions>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer(
          listenerMiddleware((set, get, store) => ({
            ...defaultStoreState,
            ...createUserPreferencesSlice(set, get, store),
            resetStore() {
              set(defaultStoreState);
            },
          })),
        ),
      ),
      persistConfig,
    ),
    devtoolsConfig,
  ),
);
```

### Middleware Stack (inside-out)

1. **immer** — Enables mutable draft syntax in actions
2. **subscribeWithSelector** — Allows fine-grained subscriptions with selectors
3. **persist** — Persists to `localStorage` with migration support
4. **devtools** — Redux DevTools integration (disabled in production)

## Slice Pattern

```typescript
// src/stores/slices/user-preferences-slice.ts
import type { StateCreator } from "zustand";

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  language: "en" | "es" | "pt";
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY";
}

export interface UserPreferencesActions {
  setTheme: (theme: UserPreferences["theme"]) => void;
  setLanguage: (language: UserPreferences["language"]) => void;
  setDateFormat: (dateFormat: UserPreferences["dateFormat"]) => void;
}

export function createUserPreferencesSlice(
  set: Parameters<StateCreator<Store & StoreActions>>[0],
): UserPreferencesActions {
  return {
    setTheme: (theme) =>
      set((state) => {
        state.userPreferences.theme = theme;
      }),
    setLanguage: (language) =>
      set((state) => {
        state.userPreferences.language = language;
      }),
    setDateFormat: (dateFormat) =>
      set((state) => {
        state.userPreferences.dateFormat = dateFormat;
      }),
  };
}
```

## Persistence Configuration

```typescript
const persistConfig = {
  name: "user-preferences-storage",
  version: 1,
  migrate: (persistedState: unknown, version: number) => {
    // Handle migration from version 0 to 1
    if (version === 0) {
      /* transform state */
    }
    return persistedState as Store & StoreActions;
  },
};
```

## Usage in Components

```typescript
// Read state with selector (fine-grained re-renders)
const theme = useAppStore((state) => state.userPreferences.theme);

// Dispatch action
const setTheme = useAppStore((state) => state.setTheme);
setTheme("dark");

// Reset store
const resetStore = useAppStore((state) => state.resetStore);
```

## Adding a New Slice

1. Create `src/stores/slices/<name>-slice.ts` with state interface + actions
2. Export a `create<Name>Slice(set, get, store)` factory function
3. Add state type and actions to the root `Store & StoreActions` types in `index.ts`
4. Spread the slice into the store creator: `...create<Name>Slice(set, get, store)`
5. Add default values to `defaultStoreState`
6. If needed, create a listener in `src/stores/listeners/` for side effects

## Rules

- **Never import Zustand store in services** — stores are React-only
- **Use selectors** to avoid unnecessary re-renders: `useAppStore((s) => s.theme)` not `useAppStore()`
- **Immer syntax** for mutations: `set((state) => { state.foo = bar; })` — not spread
- **Persist only user preferences** — never persist auth state, tokens, or server data
- **Devtools disabled in production** via `enabled: getRuntimeValue("ENVIRONMENT") !== "prod"`
