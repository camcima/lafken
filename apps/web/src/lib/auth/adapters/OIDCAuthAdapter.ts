/**
 * OIDC authentication adapter
 * Implements the IAuthProvider interface for any OIDC-compliant provider
 * (dev-oidc, Azure Entra ID, Keycloak, Auth0, etc.) via oidc-client-ts.
 */
import type { User, UserManagerSettings } from "oidc-client-ts";
import { UserManager, WebStorageStateStore } from "oidc-client-ts";

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
 * OIDC adapter configuration
 */
export interface OIDCAdapterConfig {
  /** OIDC issuer URL, e.g. http://localhost:8095 */
  authority: string;
  /** OAuth 2.0 client ID */
  clientId: string;
  /** Audience claim value expected by the resource server */
  audience: string;
  /** Redirect URI registered in the OIDC provider */
  redirectUri: string;
  /** URI to redirect to after logout */
  postLogoutRedirectUri: string;
  /** Space-separated list of scopes */
  scopes: string;
}

/**
 * Decodes a JWT payload without verifying the signature.
 * The server performs signature verification — this is for reading claims on the
 * client side only.
 */
function decodeJwtClaims(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) return {};
  const payload = parts[1];
  if (!payload) return {};
  try {
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

/**
 * OIDC Authentication Adapter
 *
 * Implements the authorization-code-with-PKCE flow using oidc-client-ts.
 * Works against any OIDC-compliant provider.
 */
export class OIDCAuthAdapter implements IAuthProvider {
  private readonly manager: UserManager;
  private currentUser: AuthUser | null = null;
  private readonly authStateCallbacks: Set<(user: AuthUser | null) => void> = new Set();
  // Cached in-flight redirect callback. The OIDC code can only be redeemed
  // once; concurrent callers (e.g. React 18 StrictMode double-firing the
  // initialization effect) must share a single token-exchange request.
  private redirectCallbackPromise: Promise<void> | null = null;

  constructor(config: OIDCAdapterConfig) {
    const settings: UserManagerSettings = {
      authority: config.authority,
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      post_logout_redirect_uri: config.postLogoutRedirectUri,
      response_type: "code",
      scope: config.scopes,
      // Pass audience as an extra query parameter; required by dev-oidc and
      // respected by Auth0, Keycloak, etc.
      extraQueryParams: config.audience ? { audience: config.audience } : {},
      automaticSilentRenew: true,
      // Use userinfo_endpoint only when the provider exposes it. dev-oidc does
      // not expose a userinfo endpoint so we decode claims from the tokens.
      loadUserInfo: false,
      userStore: new WebStorageStateStore({ store: globalThis.sessionStorage }),
    };

    this.manager = new UserManager(settings);

    this.manager.events.addUserLoaded((user: User) => {
      this.currentUser = this.toAuthUser(user);
      this.notifyAuthStateChanged(this.currentUser);
    });

    this.manager.events.addUserUnloaded(() => {
      this.currentUser = null;
      this.notifyAuthStateChanged(null);
    });

    this.manager.events.addAccessTokenExpired(() => {
      void this.manager.signinSilent().catch((err: unknown) => {
        logger.warn("[OIDC] Silent renew failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    });

    this.manager.events.addSilentRenewError((err: Error) => {
      logger.error("[OIDC] Silent renew error", err, { name: err.name });
    });
  }

  async initialize(): Promise<void> {
    logger.info("[OIDC] Initializing OIDC auth provider");
    const user = await this.manager.getUser();
    if (user && !user.expired) {
      this.currentUser = this.toAuthUser(user);
      logger.info("[OIDC] Restored session from storage", {
        userId: this.currentUser.id,
      });
    }
  }

  async login(options: LoginOptions = {}): Promise<void> {
    const safeRedirect =
      options.redirectPath && isSafeRedirectPath(options.redirectPath) ? options.redirectPath : "/";
    logger.auth("[OIDC] Redirecting to OIDC provider", { redirectTo: safeRedirect });
    await this.manager.signinRedirect({
      state: { redirect: safeRedirect } as unknown as string,
    });
  }

  async logout(options: LogoutOptions = {}): Promise<void> {
    logger.auth("[OIDC] Signing out");
    // When postLogoutRedirectUri is undefined, omit it so oidc-client-ts uses
    // the constructor-level setting instead of falling back to window.location.origin.
    await this.manager.signoutRedirect(
      options.postLogoutRedirectUri
        ? { post_logout_redirect_uri: options.postLogoutRedirectUri }
        : {},
    );
  }

  async getUser(): Promise<AuthUser | null> {
    const user = await this.manager.getUser();
    return user && !user.expired ? this.toAuthUser(user) : null;
  }

  async isAuthenticated(): Promise<boolean> {
    const user = await this.manager.getUser();
    return Boolean(user && !user.expired);
  }

  async getAccessToken(options?: TokenOptions): Promise<string | null | undefined> {
    void options; // options reserved for future per-call scope overrides
    const user = await this.manager.getUser();
    if (!user || user.expired) {
      try {
        const renewed = await this.manager.signinSilent();
        return renewed?.access_token ?? null;
      } catch (err) {
        logger.warn("[OIDC] Failed to renew token silently", {
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
    }
    return user.access_token;
  }

  async handleRedirectCallback(): Promise<void> {
    if (this.redirectCallbackPromise) {
      return this.redirectCallbackPromise;
    }
    const url = globalThis.location.href;
    if (!url.includes("code=") && !url.includes("error=")) {
      return;
    }
    this.redirectCallbackPromise = (async () => {
      logger.info("[OIDC] Handling redirect callback");
      const result = await this.manager.signinRedirectCallback();
      this.currentUser = this.toAuthUser(result);
      this.notifyAuthStateChanged(this.currentUser);

      const state = result.state as { redirect?: string } | undefined;
      const target = state?.redirect && isSafeRedirectPath(state.redirect) ? state.redirect : "/";

      logger.auth("[OIDC] Redirect callback handled", {
        userId: this.currentUser.id,
        redirectTarget: target,
      });

      globalThis.history.replaceState({}, "", target);
    })();
    return this.redirectCallbackPromise;
  }

  getProviderName(): string {
    return "oidc";
  }

  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
    this.authStateCallbacks.add(callback);

    // Immediately invoke with the current state so callers don't miss it.
    if (this.currentUser !== null) {
      callback(this.currentUser);
    }

    return () => {
      this.authStateCallbacks.delete(callback);
    };
  }

  private notifyAuthStateChanged(user: AuthUser | null): void {
    for (const callback of this.authStateCallbacks) {
      try {
        callback(user);
      } catch (err) {
        logger.error("[OIDC] Error in auth state callback", err as Error, {
          name: err instanceof Error ? err.name : "UnknownError",
        });
      }
    }
  }

  /**
   * Maps an oidc-client-ts User to the shared AuthUser shape.
   *
   * oidc-client-ts populates `user.profile` from the ID token.
   * dev-oidc (and most providers) also includes `roles` there. If the ID token
   * profile is empty or missing the roles claim, we fall back to decoding the
   * access token client-side (no sig verification — that's the server's job).
   */
  private toAuthUser(user: User): AuthUser {
    const idClaims = user.profile as Record<string, unknown>;

    // Prefer ID token claims; fall back to access token claims.
    const atClaims: Record<string, unknown> =
      Object.keys(idClaims).length > 1 ? idClaims : decodeJwtClaims(user.access_token);

    const id = (atClaims.sub as string | undefined) ?? "";
    const email =
      (atClaims.email as string | undefined) ??
      (atClaims.preferred_username as string | undefined) ??
      "";
    const name = (atClaims.name as string | undefined) ?? email;
    const roles = Array.isArray(atClaims.roles) ? (atClaims.roles as string[]) : [];

    return { id, email, name, roles, claims: atClaims, raw: user };
  }
}
