import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";

import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";

import { getAuthProvider } from "./auth-provider-factory";
import { OidcBearerAuthnGuard } from "./oidc/oidc-bearer-authn.guard";
import { OidcRolesAuthzGuard } from "./oidc/oidc-roles-authz.guard";

const BearerAuthnStrategy = getAuthProvider(environmentConfiguration.AUTH_PROVIDER);

@Module({
  imports: [PassportModule],
  providers: [BearerAuthnStrategy, OidcRolesAuthzGuard, OidcBearerAuthnGuard],
  exports: [OidcRolesAuthzGuard, OidcBearerAuthnGuard],
})
export class AuthModule {}
