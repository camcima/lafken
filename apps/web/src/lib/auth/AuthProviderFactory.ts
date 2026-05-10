/**
 * Auth Provider Factory
 * Creates the appropriate auth provider based on configuration.
 * Lafken supports OIDC only; the legacy mock provider was removed because
 * dev environments use the local dev-oidc container.
 */
import { getRuntimeValue } from "@/config/app-config";
import { logger } from "@/lib/logger";

import { OIDCAuthAdapter } from "./adapters/OIDCAuthAdapter";
import { getOIDCConfig } from "./config/oidc-config";
import type { IAuthProvider } from "./interface/IAuthProvider";

/**
 * Singleton promise — caching the promise (not just the result) prevents
 * concurrent callers from each creating their own instance, which is
 * critical under React Strict Mode where effects double-fire.
 */
let authProviderPromise: Promise<IAuthProvider> | null = null;

/**
 * Creates an OIDC auth provider.
 * @returns The configured OIDCAuthAdapter instance
 */
export const createAuthProvider = (): Promise<IAuthProvider> => {
  logger.info("Creating auth provider: oidc");
  const oidcConfig = getOIDCConfig();
  return Promise.resolve(new OIDCAuthAdapter(oidcConfig));
};

/**
 * Gets or creates the singleton auth provider instance.
 * @returns The auth provider instance
 */
export const getAuthProvider = async (): Promise<IAuthProvider> => {
  if (!authProviderPromise) {
    authProviderPromise = (async () => {
      const providerType = getRuntimeValue("AUTH_PROVIDER");
      logger.info(`Initializing auth provider: ${providerType}`);

      return createAuthProvider();
    })();
  }

  return authProviderPromise;
};

/**
 * Resets the auth provider instance.
 * Useful for testing or when switching providers at runtime.
 */
export const resetAuthProvider = (): void => {
  logger.warn("Resetting auth provider instance");
  authProviderPromise = null;
};

/**
 * Sets a custom auth provider instance.
 * Useful for testing or custom implementations.
 * @param provider The auth provider instance to use
 */
export const setAuthProvider = (provider: IAuthProvider): void => {
  logger.info(`Setting custom auth provider: ${provider.getProviderName()}`);
  authProviderPromise = Promise.resolve(provider);
};
