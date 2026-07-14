> **Archived**: This document describes the Backend architecture which was removed from the monorepo. Retained for historical reference only.

## Authentication and Authorization with OIDC

To implement auth in the application, we will have an `AuthModule` (`auth.module.ts`).
For OIDC-based auth it will require the OIDC provider configuration variables defined in
`apps/backend/src/shared/infrastructure/environment.configuration.ts`.

This module is:

- A cross-cutting concern, as it can be used in multiple bounded contexts;
- Infrastructural as it depends on external libs, such as `@nestjs/passport`, etc.;
- A driving-side concern, because it acts before invoking use cases.

Its capabilities are:

- Exposes the method decorator `@AuthenticatedEndpoint()` to indicate that an endpoint (presentation layer) requires a valid OIDC bearer token. Otherwise, a '401 Unauthorized' error
  - You can use that decorator at the controller class instead of its method to ensure that all the endpoints will be private
- Exposes the parameter decorator `@AuthenticatedUser()` to facilitate retrieving the authenticated user via a valid OIDC bearer token. The type alias `AuthenticatedUser` should be used as the parameter type to maintain type-safety.
- Exposes the method decorator `@EndpointRequiredRoles()` to require role-based authorization (RBAC) on the annotated method

Example:

```ts
@Controller("users")
class UserController {
  // ✅ GOOD - rely on the `AuthenticatedUser` as decorator and type
  @Get()
  @AuthenticatedEndpoint() // ensures that this route is protected
  async getSelfUserInfo(
    @AuthenticatedUser() authenticatedUser: AuthenticatedUser, // accessing the authenticated user
  ) {
    // ...
  }

  @Get("foo")
  @AuthenticatedEndpoint()
  async getFoo(
    // ❌ BAD - the parameter is not type-safe
    @AuthenticatedUser() authenticatedUser: any,
  ) {
    // ...
  }

  // ❌ BAD - the `@AuthenticatedEndpoint()` decorator is missing
  @Get("foo")
  async getFoo(@AuthenticatedUser() authenticatedUser: AuthenticatedUser) {
    // ...
  }
}
```

### Local development and tests

The Azure AD bearer strategy described in earlier revisions of this guide has been removed. Lafken authenticates API requests via OIDC only (`AUTH_PROVIDER` is pinned to the literal `"oidc"`; there is no `mock` provider). For local development and the automated test suites, the `dev-oidc` container (`apps/backend/dev-oidc.config.json`) issues real OIDC tokens against configurable profiles/roles; the implementation lives under `apps/backend/src/shared/presentation/auth/`.
