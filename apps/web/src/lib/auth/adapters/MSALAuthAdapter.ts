/**
 * MSAL (Microsoft Authentication Library) adapter
 * Implements the IAuthProvider interface for Azure AD authentication
 */
import type {
  AccountInfo,
  AuthenticationResult,
  IPublicClientApplication,
} from "@azure/msal-browser";
import { LogLevel } from "@azure/msal-browser";

import { getRuntimeValue } from "@/config/app-config";
import type {
  AuthUser,
  IAuthProvider,
  LoginOptions,
  LogoutOptions,
  TokenOptions,
} from "@/lib/auth/interface/IAuthProvider";
import { isSafeRedirectPath } from "@/lib/auth/validateRedirect";
import { logger } from "@/lib/logger";

/**
 * MSAL-specific configuration
 */
export interface MSALConfig {
  /** Azure AD Client ID */
  clientId: string;
  /** Azure AD Tenant ID */
  tenantId: string;
  /** Redirect URI after authentication */
  redirectUri: string;
  /** Default scopes for authentication */
  defaultScopes: string[];
  /** Cache location (localStorage or sessionStorage) */
  cacheLocation?: "localStorage" | "sessionStorage";
  /** Enable verbose logging in development */
  enableLogging?: boolean;
}

/**
 * MSAL Authentication Adapter
 * Wraps Azure MSAL library to implement the IAuthProvider interface
 */
export class MSALAuthAdapter implements IAuthProvider {
  private msalInstance: IPublicClientApplication | null = null;
  private readonly config: MSALConfig;
  private readonly authStateCallbacks: Set<(user: AuthUser | null) => void> = new Set();
  private currentUser: AuthUser | null = null;
  private redirectPromise: Promise<AuthenticationResult | null> | null = null;

  constructor(config: MSALConfig, msalInstance?: IPublicClientApplication) {
    this.config = config;
    if (msalInstance) {
      this.msalInstance = msalInstance;
    }
  }

  /**
   * Lazy initialization of MSAL instance
   * Only imports and creates instance when needed
   */
  private async getMsalInstance(): Promise<IPublicClientApplication> {
    if (this.msalInstance) {
      return this.msalInstance;
    }

    // Lazy import to avoid bundling MSAL if using different provider
    const { PublicClientApplication } = await import("@azure/msal-browser");

    const isDevelopment = getRuntimeValue("ENVIRONMENT") !== "prod";

    const msalConfig = {
      auth: {
        clientId: this.config.clientId,
        authority: `https://login.microsoftonline.com/${this.config.tenantId}`,
        redirectUri: this.config.redirectUri,
        postLogoutRedirectUri: this.config.redirectUri,
      },
      cache: {
        cacheLocation: this.config.cacheLocation ?? "sessionStorage",
      },
      system: {
        loggerOptions: {
          loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
            if (containsPii) return;

            const logPrefix = "[MSAL]";
            switch (level) {
              case LogLevel.Error:
                logger.error(`${logPrefix} ${message}`);
                break;
              case LogLevel.Warning:
                logger.warn(`${logPrefix} ${message}`);
                break;
              case LogLevel.Info:
                logger.info(`${logPrefix} ${message}`);
                break;
              case LogLevel.Verbose:
                if (isDevelopment) {
                  logger.debug(`${logPrefix} ${message}`);
                }
                break;
            }
          },
          logLevel: isDevelopment ? LogLevel.Verbose : LogLevel.Warning,
          piiLoggingEnabled: false,
        },
      },
    };

    this.msalInstance = new PublicClientApplication(msalConfig);
    await this.msalInstance.initialize();

    return this.msalInstance;
  }

  /**
   * Converts MSAL AccountInfo to standardized AuthUser
   */
  private convertToAuthUser(account: AccountInfo): AuthUser {
    return {
      id: account.homeAccountId,
      email: account.username,
      name: account.name ?? account.username,
      roles: account.idTokenClaims?.roles ?? [],
      groups: account.idTokenClaims?.groups ? (account.idTokenClaims.groups as string[]) : [],
      claims: account.idTokenClaims ?? {},
      raw: account,
    };
  }

  /**
   * Gets default scopes for authentication
   */
  private getDefaultScopes(): string[] {
    return this.config.defaultScopes;
  }

  /**
   * Notifies all registered callbacks about auth state changes
   */
  private notifyAuthStateChanged(user: AuthUser | null): void {
    this.currentUser = user;
    for (const callback of this.authStateCallbacks) {
      try {
        callback(user);
      } catch (error) {
        logger.error("Error in auth state callback", error as Error);
      }
    }
  }

  /**
   * Ensures handleRedirectPromise is called exactly once per page load,
   * even under React Strict Mode (which double-mounts effects in dev).
   */
  private async getRedirectResult(): Promise<AuthenticationResult | null> {
    const instance = await this.getMsalInstance();

    if (!this.redirectPromise) {
      this.redirectPromise = instance.handleRedirectPromise({
        navigateToLoginRequestUrl: true,
      });
    }

    return this.redirectPromise;
  }

  async initialize(): Promise<void> {
    try {
      logger.info("Initializing MSAL auth provider");

      // Handle redirect promise on initialization (deduplicated)
      await this.getRedirectResult();

      // Set active account if available
      const instance = await this.getMsalInstance();
      const accounts = instance.getAllAccounts();
      if (accounts.length > 0) {
        instance.setActiveAccount(accounts[0]);
        const user = this.convertToAuthUser(accounts[0]);
        this.notifyAuthStateChanged(user);

        logger.auth("MSAL initialized with active account", {
          userId: user.id,
          email: user.email,
        });
      }

      logger.info("MSAL auth provider initialized successfully");
    } catch (error) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      logger.error("MSAL initialization failed", errorInstance);
      throw error;
    }
  }

  async login(options?: LoginOptions): Promise<void> {
    try {
      logger.auth("Login attempt started", { options });
      const instance = await this.getMsalInstance();

      if (options?.redirectPath && isSafeRedirectPath(options.redirectPath)) {
        sessionStorage.setItem("auth_redirect_path", options.redirectPath);
      }

      const loginRequest = {
        scopes: options?.scopes ?? this.getDefaultScopes(),
        prompt: options?.prompt ?? ("select_account" as const),
        ...options?.extraOptions,
      };

      await instance.loginRedirect(loginRequest);
    } catch (error) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      logger.error("Login failed", errorInstance, { options });
      throw error;
    }
  }

  async logout(options?: LogoutOptions): Promise<void> {
    try {
      logger.auth("Logout attempt started");
      const instance = await this.getMsalInstance();

      // Notify state change before logout
      this.notifyAuthStateChanged(null);

      await instance.logoutRedirect({
        postLogoutRedirectUri: options?.postLogoutRedirectUri ?? globalThis.location.origin,
        ...options?.extraOptions,
      });
    } catch (error) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      logger.error("Logout failed", errorInstance);
      throw error;
    }
  }

  async getUser(): Promise<AuthUser | null> {
    try {
      const instance = await this.getMsalInstance();
      const account = instance.getActiveAccount();

      if (!account) {
        const accounts = instance.getAllAccounts();
        if (accounts.length > 0) {
          instance.setActiveAccount(accounts[0]);
          return this.convertToAuthUser(accounts[0]);
        }
        return null;
      }

      return this.convertToAuthUser(account);
    } catch (error) {
      logger.error("Failed to get user", error as Error);
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const user = await this.getUser();
    return user !== null;
  }

  async getAccessToken(options?: TokenOptions): Promise<string | null | undefined> {
    try {
      const instance = await this.getMsalInstance();
      const account = instance.getActiveAccount();

      if (!account) {
        throw new Error("No active account found");
      }

      logger.debug("Attempting silent token acquisition");

      const tokenRequest = {
        account,
        scopes: options?.scopes ?? this.getDefaultScopes(),
        forceRefresh: options?.forceRefresh ?? false,
        ...options?.extraOptions,
      };

      const response: AuthenticationResult = await instance.acquireTokenSilent(tokenRequest);

      if (response.accessToken) {
        logger.auth("Token acquired successfully (silent)", {
          userId: account.homeAccountId,
          scopes: tokenRequest.scopes,
        });

        return response.accessToken;
      }

      return null;
    } catch (error) {
      logger.warn("Silent token acquisition failed, attempting interactive", {
        error: error instanceof Error ? error.message : String(error),
      });

      try {
        const instance = await this.getMsalInstance();
        await instance.acquireTokenRedirect({
          scopes: options?.scopes ?? this.getDefaultScopes(),
          ...options?.extraOptions,
        });

        logger.auth("Token acquired successfully (interactive)");
      } catch (interactiveError) {
        const errorInstance =
          interactiveError instanceof Error
            ? interactiveError
            : new Error(String(interactiveError));
        logger.error("Interactive token acquisition failed", errorInstance);
        throw interactiveError;
      }
    }
  }

  async handleRedirectCallback(): Promise<void> {
    try {
      const instance = await this.getMsalInstance();
      const result = await this.getRedirectResult();

      if (result?.account) {
        instance.setActiveAccount(result.account);
        const user = this.convertToAuthUser(result.account);
        this.notifyAuthStateChanged(user);

        logger.auth("Redirect callback handled successfully", {
          userId: user.id,
        });

        // Handle stored redirect path
        const storedPath = sessionStorage.getItem("auth_redirect_path");
        if (storedPath) {
          sessionStorage.removeItem("auth_redirect_path");
          logger.auth("Redirect path found", { path: storedPath });
        }
      }
    } catch (error) {
      logger.error("Failed to handle redirect callback", error as Error);
      throw error;
    }
  }

  getProviderName() {
    return "msal";
  }

  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
    this.authStateCallbacks.add(callback);

    // Immediately call with current state
    if (this.currentUser !== null) {
      callback(this.currentUser);
    }

    // Return unsubscribe function
    return () => {
      this.authStateCallbacks.delete(callback);
    };
  }
}
