# Adding Public Routes

The web app is **private by default**. Every URL except `/auth/login` is
gated by the `_protected` pathless layout in
`apps/web/src/routes/_protected.tsx`, which redirects unauthenticated
visitors to `/auth/login?redirect=<original-path>`.

If a derived project needs public pages — marketing, status, public
docs, an `/about`, a maintenance screen — follow this guide.

## Where routes live

```
apps/web/src/routes/
  __root.tsx              # global shell + devtools, no auth logic
  _protected.tsx          # auth guard + MainLayout + health check
  _protected/
    index.tsx             # / — the authenticated home
    ...                   # any new authenticated route goes here
  auth/
    login.tsx             # /auth/login — the only public route today
```

`_protected.tsx` is a **pathless layout**: the leading `_` means it
contributes no path segment. Any file under `routes/_protected/` is a
child route rendered through the layout's `<Outlet />`, so it inherits
auth gating, the error boundary, and the post-auth health check.

Files at the top level of `routes/` (e.g. `auth/login.tsx`) are public
because they sit outside `_protected`.

## Adding a public route

To add `/about` as a public marketing page:

1. Create the file outside `_protected/`:

   ```tsx
   // apps/web/src/routes/about.tsx
   import { createFileRoute } from "@tanstack/react-router";

   export const Route = createFileRoute("/about")({
     component: AboutPage,
   });

   function AboutPage() {
     return <main className="p-8">…</main>;
   }
   ```

2. Run the dev server once (`pnpm -F web dev`) so the TanStack Router
   plugin regenerates `routeTree.gen.ts` with the new entry.

3. Done. The route renders without auth or health checks.

If you need several public pages, group them under a pathless layout:

```
apps/web/src/routes/
  _public.tsx             # optional shared layout for marketing pages
  _public/
    about.tsx             # /about
    pricing.tsx           # /pricing
```

## Adding a public route under a different shell

Public routes don't need `MainLayout` (it includes navigation and the
language switcher meant for authenticated users). For a marketing
shell, add a sibling layout:

```tsx
// apps/web/src/routes/_public.tsx
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_public")({
  component: () => (
    <div className="bg-slate-50">
      <Outlet />
    </div>
  ),
});
```

Then put files under `routes/_public/`.

## Don't put auth-required logic in public routes

A public route runs **before** the user is known. Don't read `useAuth`
to branch on `isAuthenticated` — instead, link to the protected area
and let `_protected.tsx` redirect. If you need to greet authenticated
visitors differently, use `useAuth` defensively:

```tsx
const { user } = useAuth();
return user ? <Welcome name={user.name} /> : <Welcome />;
```

…but consider whether the page belongs under `_protected/` instead.

## Don't break the auth redirect

`_protected.tsx` preserves the original URL in
`/auth/login?redirect=<href>`. After login, `LoginPage` reads the
search param and navigates back. Two invariants to keep:

- Public routes must **not** be valid redirect targets — anything
  under `_protected/` is. The default fallback in
  `apps/web/src/lib/auth/validateRedirect.ts` (`DEFAULT_FALLBACK`) is
  typed against `routeTree.gen.ts['fullPaths']`, so a route rename
  fails at build time. Update the constant when you add a new
  preferred landing route.
- `sanitizeRedirectPath` rejects external URLs, scheme-style payloads
  (`javascript:`, `data:`), and protocol-relative paths (`//evil`).
  Don't bypass it.

## Testing

The Playwright smoke suite in `shared/web-tests/e2e/smoke.spec.ts`
asserts that `/` and an arbitrary protected path both redirect to
`/auth/login` with the redirect preserved. If you add public routes,
extend the suite with a test that hits the new path **without**
authentication and asserts it renders normally.
