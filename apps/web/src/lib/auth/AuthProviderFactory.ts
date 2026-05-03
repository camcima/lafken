/**
 * Auth Provider Factory
 * Creates the appropriate auth provider based on configuration
 */
import { getRuntimeValue } from "@/config/app-config";
import { logger } from "@/lib/logger";

import { MSALAuthAdapter } from "./adapters/MSALAuthAdapter";
import { getMSALConfig } from "./config/msal-config";
import type { IAuthProvider } from "./interface/IAuthProvider";

/**
 * Supported authentication providers
 */
export type AuthProviderType = "msal" | "mock" | undefined | (string & {});

/**
 * Auth provider factory configuration
 */
export interface AuthProviderFactoryConfig {
  /** The type of auth provider to create */
  providerType: AuthProviderType;
  /** Additional provider-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * Singleton promise — caching the promise (not just the result) prevents
 * concurrent callers from each creating their own instance, which is
 * critical under React Strict Mode where effects double-fire.
 */
let authProviderPromise: Promise<IAuthProvider> | null = null;

/**
 * Creates an auth provider based on configuration
 * @param config Factory configuration
 * @returns The configured auth provider instance
 */
export const createAuthProvider = async (
  config: AuthProviderFactoryConfig,
): Promise<IAuthProvider> => {
  const { providerType } = config;

  logger.info(`Creating auth provider: ${providerType}`);

  if (providerType === "msal" || !providerType) {
    const msalConfig = getMSALConfig();
    return new MSALAuthAdapter(msalConfig);
  }

  if (providerType === "mock") {
    if (import.meta.env.MODE === "production") {
      throw new Error(
        "Mock auth provider is not allowed in production builds. " +
          "This indicates a misconfigured AUTH_PROVIDER environment variable.",
      );
    }
    const { MockAuthAdapter } = await import("@/mocks/MockAuthAdapter");
    return new MockAuthAdapter();
  }

  throw new Error(`Unknown auth provider type: ${providerType}`);
};

/**
 * Gets or creates the singleton auth provider instance
 * @returns The auth provider instance
 */
export const getAuthProvider = async (): Promise<IAuthProvider> => {
  if (!authProviderPromise) {
    authProviderPromise = (async () => {
      const providerType = getRuntimeValue("AUTH_PROVIDER");
      logger.info(`Initializing auth provider: ${providerType}`);

      return createAuthProvider({ providerType });
    })();
  }

  return authProviderPromise;
};

/**
 * Resets the auth provider instance
 * Useful for testing or when switching providers at runtime
 */
export const resetAuthProvider = (): void => {
  logger.warn("Resetting auth provider instance");
  authProviderPromise = null;
};

/**
 * Sets a custom auth provider instance
 * Useful for testing or custom implementations
 * @param provider The auth provider instance to use
 */
export const setAuthProvider = (provider: IAuthProvider): void => {
  logger.info(`Setting custom auth provider: ${provider.getProviderName()}`);
  authProviderPromise = Promise.resolve(provider);
};
