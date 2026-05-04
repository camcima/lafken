/* v8 ignore file */
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { Strategy } from "passport-strategy";

import { ApplicationRole } from "@/shared/kernel/domain/application-roles";

import type { CurrentAuthenticatedUserDTO } from "../dto/current-authenticated-user.dto";
import { STRATEGY_KEY } from "./oidc-bearer-authn.strategy";

const TEST_ROLES_HEADER = "x-test-roles";

/**
 * This strategy is used for local development and testing purposes.
 * It was made to replace the `OidcBearerAuthnStrategy` strategy so that we
 * can force any value we want to forge the authenticated user object.
 *
 * To override the user's roles per-request (typically from e2e tests), set
 * the `x-test-roles` header to a comma-separated list of role values, e.g.:
 *   `x-test-roles: lafken_content_reviewer`
 * When the header is missing or empty the strategy falls back to a single
 * `lafken_platform_operator` role to keep existing test fixtures working.
 */
export class MockOidcBearerAuthnStrategy extends PassportStrategy(Strategy, STRATEGY_KEY) {
  authenticate(req: Request): void {
    const validatedUser = this.validate(req);
    this.success(validatedUser);
  }

  validate(req: Request): CurrentAuthenticatedUserDTO {
    const headerValue: unknown = req.headers[TEST_ROLES_HEADER];
    const overrideRoles: ApplicationRole[] | null =
      typeof headerValue === "string" && headerValue.length > 0
        ? (headerValue
            .split(",")
            .map((r) => r.trim())
            .filter((r) => r.length > 0) as ApplicationRole[])
        : null;

    const fakeUser: CurrentAuthenticatedUserDTO = {
      bp: "1234567",
      emailAddress: "test@test.com",
      roles: overrideRoles ?? [ApplicationRole.PLATFORM_OPERATOR],
      name: "Joaquin Hernandez Admin",
    };
    return fakeUser;
  }
}
