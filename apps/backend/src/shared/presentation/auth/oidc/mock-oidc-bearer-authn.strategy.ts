/* v8 ignore file */
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { Strategy } from "passport-strategy";

import { ApplicationRole } from "@/shared/kernel/domain/application-roles";

import type { CurrentAuthenticatedUserDTO } from "../dto/current-authenticated-user.dto";
import { STRATEGY_KEY } from "./oidc-bearer-authn.strategy";

const TEST_ROLES_HEADER = "x-test-roles";

const KNOWN_ROLES: readonly ApplicationRole[] = Object.values(ApplicationRole);

function parseRolesFromHeader(headerValue: unknown): ApplicationRole[] {
  const raw = Array.isArray(headerValue) ? headerValue.join(",") : headerValue;
  if (typeof raw !== "string" || raw.length === 0) {
    return [ApplicationRole.PLATFORM_OPERATOR];
  }
  const validated = raw
    .split(",")
    .map((r) => r.trim())
    .filter((r): r is ApplicationRole => (KNOWN_ROLES as readonly string[]).includes(r));
  return validated.length > 0 ? validated : [ApplicationRole.PLATFORM_OPERATOR];
}

/**
 * This strategy is used for local development and testing purposes.
 * It was made to replace the `OidcBearerAuthnStrategy` strategy so that we
 * can force any value we want to forge the authenticated user object.
 *
 * To override the user's roles per-request (typically from e2e tests), set
 * the `x-test-roles` header to a comma-separated list of role values, e.g.:
 *   `x-test-roles: lafken_content_reviewer`
 * Unknown role values are dropped so a typo does not silently inject a
 * fake role. When the header is missing, empty, or contains only unknown
 * values the strategy falls back to a single `lafken_platform_operator`
 * role to keep existing test fixtures working.
 */
export class MockOidcBearerAuthnStrategy extends PassportStrategy(Strategy, STRATEGY_KEY) {
  authenticate(req: Request): void {
    const validatedUser = this.validate(req);
    this.success(validatedUser);
  }

  validate(req: Request): CurrentAuthenticatedUserDTO {
    const fakeUser: CurrentAuthenticatedUserDTO = {
      bp: "1234567",
      emailAddress: "test@test.com",
      roles: parseRolesFromHeader(req.headers[TEST_ROLES_HEADER]),
      name: "Joaquin Hernandez Admin",
    };
    return fakeUser;
  }
}
