import { OidcBearerAuthnStrategy } from "./oidc/oidc-bearer-authn.strategy";

/**
 * Returns the bearer-token authentication strategy. Lafken supports OIDC only;
 * the legacy mock provider was removed because dev environments use the local
 * dev-oidc container (see apps/backend/docker-compose.yml).
 */
export function getAuthProvider(): typeof OidcBearerAuthnStrategy {
  return OidcBearerAuthnStrategy;
}
