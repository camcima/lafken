import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type AnyRoute,
  type AnyRouter,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  type RouteComponent,
  RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ComponentType } from "react";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

export interface IProtectedRouteSpec {
  /** URL path under the pathless `_protected` layout, e.g. "assets" or "audit". */
  path: string;
  /** True when the real route is an index file (`assets/index.tsx`, `legal-holds.index.tsx`). */
  index: boolean;
  component: ComponentType;
  /** The Zod search schema exported by the real route file, when it has one. */
  validateSearch?: unknown;
}

/**
 * Mounts a page component under a REAL TanStack Router in memory mode,
 * recreating the file-based route ids (`/_protected/<path>` or
 * `/_protected/<path>/`) so strict `useSearch({ from })` calls resolve and
 * `navigate({ search })` writes are observable on `router.state.location`.
 */
export async function renderWithRouter(
  spec: IProtectedRouteSpec,
  initialUrl: string,
  queryClient?: QueryClient,
): Promise<{ router: AnyRouter; client: QueryClient }> {
  const rootRoute = createRootRoute({ component: Outlet });

  const protectedLayout = createRoute({
    getParentRoute: () => rootRoute,
    id: "_protected",
    component: Outlet,
  });

  const searchOption = spec.validateSearch ? { validateSearch: spec.validateSearch as never } : {};

  // `ComponentType` (React) also admits class components, which TanStack's
  // `RouteComponent` type does not; every real page component in this app is
  // a function component, so this cast is safe.
  const pageComponent = spec.component as RouteComponent;

  let sectionRoute: AnyRoute;
  if (spec.index) {
    const section = createRoute({
      getParentRoute: () => protectedLayout,
      path: spec.path,
      component: Outlet,
    });
    const indexRoute = createRoute({
      getParentRoute: () => section,
      path: "/",
      component: pageComponent,
      ...searchOption,
    });
    // The `Register` global (from routeTree.gen.ts, merged app-wide) makes
    // the REAL route tree's TRegister diverge from the synthetic tree built
    // here, so TypeScript can't structurally match this composed route
    // against `AnyRoute` — cast at this boundary; runtime composition
    // (proven by the harness's own self-test) is unaffected.
    sectionRoute = section.addChildren([indexRoute as unknown as AnyRoute]) as unknown as AnyRoute;
  } else {
    sectionRoute = createRoute({
      getParentRoute: () => protectedLayout,
      path: spec.path,
      component: pageComponent,
      ...searchOption,
    }) as unknown as AnyRoute;
  }

  // Pages link to routes outside the harness (e.g. /assets/upload); a splat
  // route keeps those navigable without registering the whole app tree.
  const catchAll = createRoute({
    getParentRoute: () => rootRoute,
    path: "$",
    component: () => null,
  });

  const routeTree = rootRoute.addChildren([
    protectedLayout.addChildren([sectionRoute]) as unknown as AnyRoute,
    catchAll,
  ]) as unknown as AnyRoute;

  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialUrl] }),
  });

  render(
    <I18nProvider>
      <QueryClientProvider client={client}>
        <RouterProvider router={router as never} />
      </QueryClientProvider>
    </I18nProvider>,
  );
  await router.load();

  return { router: router as AnyRouter, client };
}
