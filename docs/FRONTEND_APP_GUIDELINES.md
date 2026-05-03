# Frontend Template Guide (eMantto)

This document describes the architecture, technologies, and development guidelines for the eMantto application frontend, based on the LATAM Airlines needs.

## 🏗️ Introduction and Architectural Decisions

This template has been designed following modern architecture principles, scalability, and maintainability. The key decisions underpinning the project structure are detailed below:

### 1. Monorepo Architecture (Turborepo)

The project is part of a monorepo managed with **Turborepo** and **pnpm workspaces**. This decision allows for:

- **Code Sharing**: DTOs, types, and interfaces are shared directly between the Backend and the Frontend, ensuring type consistency (`@shared/backend-api`).
- **Unified Management**: Coordinated linting, testing, and builds for all packages.
- **Speed**: Distributed build cache to accelerate CI/CD times.

### 2. API Layer (Backend)

A **Backend (BE)** built in NestJS is used as an intermediary between the Frontend and downstream services.

- **Abstraction**: The frontend does not need to know the complexity of the underlying microservices.
- **Security**: Authentication and handling of sensitive tokens are centralized in the BE.
- **Performance**: Aggregation of multiple API calls into a single response for the client.

### 3. End-to-End "Type-Safe" Approach

Type safety is a priority. From the database to the UI:

- **Strict TypeScript**: Strict configuration (`strict: true`) throughout the project.
- **TanStack Router**: Ensures no broken links or navigation parameter errors at compile time.
- **Zod**: Runtime data validation that automatically infers static types.

### 4. UI and Business Logic Separation

- **"Smart" Components (Business)**: Located in `components/business`, they handle domain logic, API calls, and complex state.
- **"Dumb" Components (Common/UI)**: Located in `components/common`, they are purely presentational, reusable, and visually testable with Storybook.
- **Shadcn/ui**: Provides a base of accessible and customizable components without the coupling of a traditional component library (the code lives in your repo).

### 5. Server State vs. Client State

A clear distinction is made in state management:

- **Server State (TanStack Query)**: For data coming from the server. Automatically handles caching, revalidation, and loading/error states.
- **Client State (Zustand/Context)**: For global UI state (e.g., theme, authenticated user, preferences) that does not persist in the backend.

## 🚀 Overview

The frontend is built as a modern Single Page Application (SPA) using the **React** and **TanStack** ecosystem, optimized for performance, maintainability, and developer experience. The project resides in `apps/web` within the monorepo.

## 🛠 Tech Stack

### Core

- **React 19**: UI Library.
- **Vite 7**: Build tool and ultra-fast development server.
- **TypeScript**: Strict typed language.

### State and Data

- **TanStack Query (React Query)**: Asynchronous state management (server).
- **Zustand**: Complex global state management (client).
- **React Context**: For simple global states (e.g., Auth, Theme).

### Routing

- **TanStack Router**: Type-safe file-based routing.

### UI and Styles

- **Tailwind CSS v4**: Utility-first CSS framework.
- **Shadcn/ui**: Reusable components built on top of Radix UI.
- **Lucide React**: Icon library.

### Forms and Validation

- **React Hook Form**: Performant form management.
- **Zod**: Schema validation (integrated with RHF and Router).

### Internationalization

- **i18next**: Translation management (ES, EN, PT).

### Observability

- **Grafana Faro**: Web SDK for frontend monitoring, errors, and traces.

### Testing

- **Vitest**: Unit test runner.
- **React Testing Library**: Component testing.
- **Playwright**: End-to-End testing (located in `shared/web-tests`).
- **MSW (Mock Service Worker)**: API mocking for development and tests.

## 📂 Project Structure (`apps/web/src`)

```text
src/
├── components/       # UI Components
│   ├── business/     # Business components (with domain logic)
│   ├── common/       # Generic reusable components (Buttons, Modals)
│   ├── feedback/     # User feedback (Loaders, Errors, Toast)
│   ├── forms/        # Form components
│   └── navigation/   # Menus, Sidebars, Breadcrumbs
├── config/           # App configuration (env vars, flags)
├── contexts/         # React Contexts (RootProvider, AuthContext)
├── hooks/            # Custom Hooks (useAuth, useUserService)
├── layouts/          # Page layouts (MainLayout, AuthLayout)
├── lib/              # Utilities and library configurations (API, Logger, i18n)
├── mocks/            # MSW handlers for local development
├── pages/            # Page components (full views)
├── routes/           # Route definition (File-based routing)
├── services/         # Service layer for API calls
├── stores/           # Zustand stores
├── styles/           # Global CSS and Tailwind configuration
└── types/            # Global type definitions
```

## 📖 Development Guidelines

### 1. Routing (TanStack Router)

Routes are automatically defined based on the file structure in `src/routes/`.

- `__root.tsx`: Root layout.
- `index.tsx`: Main route `/`.
- `dashboard.tsx`: Route `/dashboard`.
- `users/$userId.tsx`: Dynamic route `/users/123`.

**Parameter Validation:**
We use `zod` to validate search parameters (query params) in routes.

```typescript
export const Route = createFileRoute("/users")({
  validateSearch: z.object({ page: z.number().optional() }),
  loader: ({ deps }) => fetchUsers(deps.search),
});
```

### 2. API Consumption

- **Services**: All HTTP calls must be encapsulated in classes within `src/services/` extending `BaseService`.
- **Hooks**: Do not use services directly in components. Wrap them in React Query hooks in `src/hooks/`.

```typescript
// src/hooks/useUserService.ts
export const useUsers = () => {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => userService.getUsers(),
  });
};
```

### 3. Styles (Tailwind v4)

- Use Tailwind utility classes for almost everything.
- Avoid inline `style={{}}`.
- For conditional classes, use the `cn()` utility (clsx + tailwind-merge).

### 4. Forms

Use `react-hook-form` combined with `zod` for validation. Define the Zod schema outside the component.

```typescript
const schema = z.object({
  email: z.string().email(),
});
// ... inside the component
const form = useForm({ resolver: zodResolver(schema) });
```

### 5. Authentication

Authentication is handled via MSAL (Microsoft Authentication Library) for Azure AD.

- `AuthContext` provides user state.
- `AuthenticatedEndpoint` and `AuthenticatedUser` are decorators used in the BE, but in the frontend, we use the token acquired by MSAL to sign requests in the `api-client`.

## 💻 Available Commands

Run from the monorepo root or inside `apps/web`:

- **Start Development**: `pnpm dev` (Starts Vite and BE if needed)
- **Unit Tests**: `pnpm test`
- **Linting**: `pnpm lint`
- **Build**: `pnpm build`
- **Storybook**: `pnpm storybook`

## 🌍 Internationalization (i18n)

Translations are located in `src/lib/i18n/locales/`.

- Use the `useTranslation()` hook for text in components.
- `t('common.buttons.save')` instead of hardcoding "Save".

## 🔍 Monitoring and Logs

Do not use `console.log` in production. Use the centralized logger that sends data to Grafana Faro.

```typescript
import { logger } from "@/lib/logger";

logger.error("Error loading users", error);
```
