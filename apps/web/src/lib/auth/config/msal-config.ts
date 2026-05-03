/**
 * MSAL-specific configuration
 * Contains all MSAL/Azure AD related configuration
 */
import { getRuntimeValue } from "@/config/app-config";
import type { MSALConfig } from "@/lib/auth/adapters/MSALAuthAdapter";

const defaultScopes = [`${getRuntimeValue("AZURE_CLIENT_ID")}/user.read`, "openid", "profile"];

/**
 * Gets MSAL configuration from runtime values
 */
export const getMSALConfig = (): MSALConfig => {
  return {
    clientId: getRuntimeValue("AZURE_CLIENT_ID"),
    tenantId: getRuntimeValue("AZURE_TENANT_ID"),
    redirectUri: getRuntimeValue("AZURE_REDIRECT_URI"),
    defaultScopes,
    cacheLocation: "sessionStorage",
    enableLogging: getRuntimeValue("ENVIRONMENT") === "intg",
  };
};
