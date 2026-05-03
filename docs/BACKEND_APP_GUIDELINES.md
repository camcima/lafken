> **Archived**: This document describes the Backend architecture which was removed from the monorepo. Retained for historical reference only.

## Authentication and Authorization with Azure AD

To implement auth in the application, we will have an `AuthModule` (`auth.module.ts`).
It will require two environment variables:

- `AUTH_TENANT_ID`
- `AUTH_CLIENT_ID`

This module is:

- A cross-cutting concern, as it can be used in multiple bounded contexts;
- Infrastructural as it depends on external libs, such as `@nestjs/passport`, etc.;
- A driving-side concern, because it acts before invoking use cases.

Its capabilities are:

- Exposes the method decorator `@AuthenticatedEndpoint()` to indicate that an endpoint (presentation layer) requires a valid Azure AD bearer token. Otherwise, a '401 Unauthorized' error
  - You can use that decorator at the controller class instead of its method to ensure that all the endpoints will be private
- Exposes the parameter decorator `@AuthenticatedUser()` to facilitate retrieving the authenticated user via a valid Azure AD bearer token. The type alias `AuthenticatedUser` should be used as the parameter type to maintain type-safety.
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

### Mock adapter for local testing

In order to test different scenarios for a valid or invalid auth, we have the `MockAzureAdBearerAuthnStrategy` adapter (`src/shared/presentation/auth/azure-ad/mock-azure-ad-bearer-authn.strategy.ts`) that will be used in case of the environment variable `AUTH_PROVIDER` is setted to `"mock"`.  
In that file you can configure any user.

Note that this only works when the `NODE_ENV` is not `"production"` - as we are not supposed to forge the auth provider.
