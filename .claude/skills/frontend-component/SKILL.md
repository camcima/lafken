---
name: frontend-component
description: Creates React 19 components following the Vite SPA architecture with shadcn/ui, Tailwind CSS v4, and CVA for variants. Covers component composition patterns (children, slot, compound), accessibility, i18n with react-i18next, and state management guidelines. Use when building UI components, implementing layouts, or following frontend patterns.
---

# Frontend Component Patterns

## Architecture Rules

- **Client-Side Rendering (CSR) ONLY** - No SSR, Server Components, or Server Actions
- **Composition over props** - Use children pattern, Slot (Radix), compound components
- **URL is Truth** - Use `searchParams` via TanStack Router for URL state
- **Server state** via TanStack Query, **UI state** via Zustand (if needed)

## Component Structure

### Reusable Component (shadcn/ui pattern)

```typescript
// components/common/Button/index.tsx
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentProps } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border bg-background shadow-xs hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md gap-1.5 px-3",
        lg: "h-10 rounded-md px-6",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className, variant, size, asChild = false, ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
```

### Feature Component (with data fetching)

```typescript
// features/Admin/components/WorkCenters.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/common/Button";
import { prefetchWorkCenters, useWorkCenters } from "@/features/Admin/hooks/useWorkCenters";

export default function WorkCenters() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data: workCenters, isLoading, error, isPlaceholderData } = useWorkCenters({ page });

  const hasMore = workCenters && workCenters.page < workCenters.lastPage;

  useEffect(() => {
    if (error) toast.error(error.message);
  }, [error]);

  // Prefetch next page
  useEffect(() => {
    if (!isPlaceholderData && hasMore) {
      prefetchWorkCenters({ page: workCenters.page + 1 });
    }
  }, [workCenters, hasMore, isPlaceholderData]);

  if (isLoading) return <div>{t("admin.loading")}</div>;
  if (error) return <div className="text-red-500">{t("admin.error")}</div>;

  return (
    <div>
      <table>/* ... */</table>
      <div className="flex gap-2">
        <Button variant="outline" size="sm"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={workCenters?.page === 1}>
          {t("admin.pagination.previous")}
        </Button>
        <Button variant="outline" size="sm"
          onClick={() => setPage((p) => p + 1)}
          disabled={!hasMore}>
          {t("admin.pagination.next")}
        </Button>
      </div>
    </div>
  );
}
```

## Layout Components

```typescript
// layouts/MainLayout.tsx
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useHasRole } from "@/hooks/useAuth";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const isAdmin = useHasRole(["admin"]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-900 shadow-sm">
        <nav className="mx-auto max-w-7xl px-4">
          <Link to="/">{t("navigation.dashboard")}</Link>
          {isAdmin && <Link to="/admin/users">Admin</Link>}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
```

## Key Rules

- **Tailwind CSS v4**: `@import "tailwindcss"`, `@theme` directives, mobile-first
- **Never construct class names dynamically** - use `cn()` utility
- **Use `react-i18next`** for all user-facing text (Spanish, Portuguese, English)
- **Accessibility**: semantic HTML, ARIA attributes, keyboard navigation, color contrast
- **Use path aliases** (`@/`) - never relative imports with `../../../`
- **Direct imports** - no barrel files or re-exports
- **State management**:
  - React Context for simple, infrequent state (theme, auth)
  - Zustand for complex, frequent updates (UI state, forms)
  - TanStack Query for server state (**never** store in Context/Zustand)
- **Performance**: `React.memo` only for expensive components, `useMemo`/`useCallback` only when needed
