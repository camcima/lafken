/**
 * OIDC provider configuration derived from runtime values.
 */
import { getRuntimeValue } from "@/config/app-config";
import type { OIDCAdapterConfig } from "@/lib/auth/adapters/OIDCAuthAdapter";

/**
 * Assembles the OIDC adapter configuration from runtime config values.
 */
export const getOIDCConfig = (): OIDCAdapterConfig => ({
  authority: getRuntimeValue("OIDC_AUTHORITY"),
  clientId: getRuntimeValue("OIDC_CLIENT_ID"),
  audience: getRuntimeValue("OIDC_AUDIENCE"),
  redirectUri: getRuntimeValue("OIDC_REDIRECT_URI"),
  postLogoutRedirectUri: getRuntimeValue("OIDC_POST_LOGOUT_REDIRECT_URI"),
  scopes: getRuntimeValue("OIDC_SCOPES"),
});
