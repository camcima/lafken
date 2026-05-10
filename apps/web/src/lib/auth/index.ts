/**
 * Public Auth API
 * Export only the interfaces and factory - hide implementation details
 */

// Core interface
export type {
  IAuthProvider,
  AuthUser,
  LoginOptions,
  LogoutOptions,
  TokenOptions,
} from "./interface/IAuthProvider";

// Factory
export { getAuthProvider, resetAuthProvider, setAuthProvider } from "./AuthProviderFactory";

// Config (for manual setup if needed)
export * from "./config";
