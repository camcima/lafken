/* v8 ignore file */
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-strategy";

import { ApplicationRole } from "@/shared/kernel/domain/application-roles";

import type { CurrentAuthenticatedUserDTO } from "../dto/current-authenticated-user.dto";
import { STRATEGY_KEY } from "./oidc-bearer-authn.strategy";

/**
 * This strategy is used for local development and testing purposes.
 * It was made to replace the `OidcBearerAuthnStrategy` strategy so that we
 * can force any value we want to forge the authenticated user object.
 */
export class MockOidcBearerAuthnStrategy extends PassportStrategy(Strategy, STRATEGY_KEY) {
  authenticate(): void {
    const validatedUser = this.validate();
    this.success(validatedUser);
  }

  validate() {
    const fakeUser: CurrentAuthenticatedUserDTO = {
      bp: "1234567",
      emailAddress: "test@test.com",
      roles: [ApplicationRole.ADMIN],
      name: "Joaquin Hernandez Admin",
    };
    return fakeUser;
  }
}
