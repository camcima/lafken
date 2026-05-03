import type { AuthUser, IAuthProvider } from "@/lib/auth";

import { mockUser } from "./user";

export class MockAuthAdapter implements IAuthProvider {
  private readonly authStateCallbacks: Set<(user: AuthUser | null) => void> = new Set();
  private currentUser: AuthUser | null = null;
  private isAuthenticatedState = false;

  initialize(): Promise<void> {
    return Promise.resolve();
  }

  // Notifies subscribers and lets the SPA navigate via the React-level
  // <Navigate> in LoginPage; never trigger a hard window.location reload
  // here, which would cancel any in-flight requests started by the new
  // route (e.g. the health check) and wipe the in-memory mock user.
  login(): Promise<void> {
    this.currentUser = mockUser;
    this.isAuthenticatedState = true;
    this.notifyAuthStateChanged(this.currentUser);
    return Promise.resolve();
  }

  logout(): Promise<void> {
    this.currentUser = null;
    this.isAuthenticatedState = false;
    this.notifyAuthStateChanged(null);
    return Promise.resolve();
  }

  getUser(): Promise<AuthUser | null> {
    return Promise.resolve(this.currentUser);
  }

  isAuthenticated(): Promise<boolean> {
    return Promise.resolve(this.isAuthenticatedState);
  }

  getAccessToken(): Promise<string> {
    return Promise.resolve("mock_access_token");
  }

  handleRedirectCallback(): Promise<void> {
    return Promise.resolve();
  }

  getProviderName(): string {
    return "mock";
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

  private notifyAuthStateChanged(user: AuthUser | null): void {
    this.currentUser = user;
    for (const callback of this.authStateCallbacks) {
      try {
        callback(user);
      } catch {
        // Silently handle callback errors in mock adapter
      }
    }
  }
}
