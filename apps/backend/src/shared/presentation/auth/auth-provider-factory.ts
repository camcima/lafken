import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";

import { MockOidcBearerAuthnStrategy } from "./oidc/mock-oidc-bearer-authn.strategy";
import { OidcBearerAuthnStrategy } from "./oidc/oidc-bearer-authn.strategy";

/**
 * This should resolve the proper auth adapter under the token `"oidc-bearer"`
 * to be used by auth-related guards and decorators.
 */
export function getAuthProvider(providerType: "oidc" | "mock") {
  if (providerType === "oidc") {
    return OidcBearerAuthnStrategy;
  }

  // Only used if not in production mode as this was designed for local development purposes
  if (providerType === "mock" && environmentConfiguration.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn("MockBearerAuthnStrategy is being used");
    return MockOidcBearerAuthnStrategy;
  }

  return OidcBearerAuthnStrategy;
}
