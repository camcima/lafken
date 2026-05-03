import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";

import { AzureAdBearerAuthnStrategy } from "./azure-ad/azure-ad-bearer-authn.strategy";
import { MockAzureAdBearerAuthnStrategy } from "./azure-ad/mock-azure-ad-bearer-authn.strategy";

/**
 * This should resolves the proper auth adapter under the token `"azure-ad-bearer-authz"`
 * to be used by auth-related guards and decorators.
 */
export function getAuthProvider(providerType: "msal" | "mock") {
  if (providerType === "msal") {
    return AzureAdBearerAuthnStrategy;
  }

  // Only used if not in production mode as this was designed for local development purposes
  if (providerType === "mock" && environmentConfiguration.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn("MockBearerAuthnStrategy is being used");
    return MockAzureAdBearerAuthnStrategy;
  }

  return AzureAdBearerAuthnStrategy;
}
