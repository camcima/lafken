/**
 * Provider-agnostic authentication interface
 * All auth providers (OIDC, mock, etc.) must implement this interface
 */

/**
 * Standardized user information across all auth providers
 */
export interface AuthUser {
  /** Unique user identifier */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name: string;
  /** User's roles (optional, provider-dependent) */
  roles?: string[];
  /** User's groups (optional, provider-dependent) */
  groups?: string[];
  /** Additional claims/metadata from the provider */
  claims?: Record<string, unknown>;
  /** Original provider-specific user object */
  raw?: unknown;
}

/**
 * Login configuration options
 */
export interface LoginOptions {
  /** Path to redirect to after successful login */
  redirectPath?: string;
  /** Additional scopes to request */
  scopes?: string[];
  /** Prompt type (select_account, login, consent, none) */
  prompt?: "select_account" | "login" | "consent" | "none";
  /** Additional provider-specific options */
  extraOptions?: Record<string, unknown>;
}

/**
 * Token acquisition options
 */
export interface TokenOptions {
  /** Scopes to request for the token */
  scopes?: string[];
  /** Force token refresh */
  forceRefresh?: boolean;
  /** Additional provider-specific options */
  extraOptions?: Record<string, unknown>;
}

/**
 * Logout configuration options
 */
export interface LogoutOptions {
  /** URL to redirect to after logout */
  postLogoutRedirectUri?: string;
  /** Additional provider-specific options */
  extraOptions?: Record<string, unknown>;
}

/**
 * Core authentication provider interface
 * All authentication adapters must implement this interface
 */
export interface IAuthProvider {
  /**
   * Initializes the auth provider
   * Should be called once during app initialization
   */
  initialize(): Promise<void>;

  /**
   * Performs user login
   * @param options Login configuration options
   */
  login(options?: LoginOptions): Promise<void>;

  /**
   * Performs user logout
   * @param options Logout configuration options
   */
  logout(options?: LogoutOptions): Promise<void>;

  /**
   * Gets the currently authenticated user
   * @returns The authenticated user or null if not authenticated
   */
  getUser(): Promise<AuthUser | null>;

  /**
   * Checks if user is currently authenticated
   * @returns True if user is authenticated, false otherwise
   */
  isAuthenticated(): Promise<boolean>;

  /**
   * Acquires an access token for API calls
   * @param options Token acquisition options
   * @returns The access token string or null/undefined value if no token is available
   */
  getAccessToken(options?: TokenOptions): Promise<string | null | undefined>;

  /**
   * Handles redirect callback after authentication
   * Should be called on app initialization to handle redirects
   */
  handleRedirectCallback(): Promise<void>;

  /**
   * Gets the provider name/type
   * @returns The provider identifier (e.g., 'oidc', 'mock')
   */
  getProviderName(): string;

  /**
   * Registers a callback for authentication state changes
   * @param callback Function to call when auth state changes
   * @returns Unsubscribe function
   */
  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void;
}
