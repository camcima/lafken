import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";

import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";

import { getAuthProvider } from "./auth-provider-factory";
import { AzureAdBearerAuthnGuard } from "./azure-ad/azure-ad-bearer-authn.guard";
import { AzureAdRolesAuthzGuard } from "./azure-ad/azure-ad-roles-authz.guard";

const BearerAuthnStrategy = getAuthProvider(environmentConfiguration.AUTH_PROVIDER);

@Module({
  imports: [PassportModule],
  providers: [BearerAuthnStrategy, AzureAdRolesAuthzGuard, AzureAdBearerAuthnGuard],
  exports: [AzureAdRolesAuthzGuard, AzureAdBearerAuthnGuard],
})
export class AuthModule {}
