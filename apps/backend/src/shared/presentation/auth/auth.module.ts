import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";

import { getAuthProvider } from "./auth-provider-factory";
import { OidcBearerAuthnGuard } from "./oidc/oidc-bearer-authn.guard";
import { OidcRolesAuthzGuard } from "./oidc/oidc-roles-authz.guard";

const BearerAuthnStrategy = getAuthProvider();

@Module({
  imports: [PassportModule],
  providers: [BearerAuthnStrategy, OidcRolesAuthzGuard, OidcBearerAuthnGuard],
  exports: [OidcRolesAuthzGuard, OidcBearerAuthnGuard],
})
export class AuthModule {}
