import { Module } from "@nestjs/common";

import { AuthorizationPort } from "@/shared/application/authorization.port";
import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";

import { AllowAllAuthorizationAdapter } from "./allow-all-authorization.adapter";

@Module({
  providers: [
    {
      provide: AuthorizationPort,
      useFactory: () => new AllowAllAuthorizationAdapter(environmentConfiguration.NODE_ENV),
    },
  ],
  exports: [AuthorizationPort],
})
export class AuthorizationModule {}
