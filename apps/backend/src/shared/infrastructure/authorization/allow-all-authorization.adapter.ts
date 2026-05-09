import { AuthorizationPort } from "@/shared/application/authorization.port";
import type {
  AuthorizationAction,
  AuthorizationPrincipal,
  AuthorizationResource,
} from "@/shared/application/authorization.port";
import { authzDecisionCounter } from "@/shared/infrastructure/telemetry/metrics";

export class AllowAllAuthorizationAdapter extends AuthorizationPort {
  constructor(environment: string) {
    super();
    if (environment === "production") {
      throw new Error(
        "AllowAllAuthorizationAdapter refuses to run in production. Configure a real AuthorizationPort adapter.",
      );
    }
  }

  can(
    _principal: AuthorizationPrincipal,
    action: AuthorizationAction,
    _resource: AuthorizationResource,
  ): Promise<boolean> {
    authzDecisionCounter.add(1, { action, result: "allow" });
    return Promise.resolve(true);
  }
}
