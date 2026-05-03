import {
  AuthorizationAction,
  AuthorizationPort,
  AuthorizationPrincipal,
  AuthorizationResource,
} from "@/shared/application/authorization.port";

export class AllowAllAuthorizationAdapter extends AuthorizationPort {
  constructor(environment: string) {
    super();
    if (environment === "production") {
      throw new Error(
        "AllowAllAuthorizationAdapter refuses to run in production. Configure a real AuthorizationPort adapter.",
      );
    }
  }

  async can(
    _principal: AuthorizationPrincipal,
    _action: AuthorizationAction,
    _resource: AuthorizationResource,
  ): Promise<boolean> {
    return true;
  }
}
