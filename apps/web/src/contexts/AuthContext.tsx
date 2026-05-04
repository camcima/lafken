import React, { createContext, useContext, useEffect, useRef, useState } from "react";

import { getAuthProvider } from "@/lib/auth/AuthProviderFactory";
import type { AuthUser } from "@/lib/auth/interface/IAuthProvider";
import { logger } from "@/lib/logger";

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  whenReady: () => Promise<void>;
  login: (redirectPath?: string) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null | undefined>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: Readonly<AuthProviderProps>) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const readyRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);

  if (readyRef.current === null) {
    let resolve!: () => void;
    const promise = new Promise<void>((_resolve) => {
      resolve = _resolve;
    });
    readyRef.current = { promise, resolve };
  }

  useEffect(() => {
    if (!isLoading && readyRef.current) {
      readyRef.current.resolve();
    }
  }, [isLoading]);

  const whenReady = () => readyRef.current?.promise ?? Promise.resolve();

  useEffect(() => {
    const initializeAuth = async () => {
      const startTime = performance.now();

      try {
        logger.auth("Initializing authentication");

        const authProvider = await getAuthProvider();
        const providerName = authProvider.getProviderName();

        logger.auth(`Using auth provider: ${providerName}`);

        await authProvider.initialize();
        await authProvider.handleRedirectCallback();

        const currentUser = await authProvider.getUser();

        if (currentUser) {
          setUser(currentUser);

          logger.setUser({
            id: currentUser.id,
            email: currentUser.email,
            name: currentUser.name,
          });

          logger.auth("User authenticated successfully", {
            userId: currentUser.id,
            email: currentUser.email,
            provider: providerName,
          });
        } else {
          logger.auth("No active user found");
        }

        logger.performance("Auth initialization", performance.now() - startTime);
      } catch (error) {
        const errorInstance = error instanceof Error ? error : new Error(String(error));

        logger.error("Authentication initialization failed", errorInstance);
      }

      // Separated from try/catch to avoid a try/finally pattern that React Compiler cannot optimize.
      setIsLoading(false);
    };

    void initializeAuth();
  }, []);

  useEffect(() => {
    let unsubscribeFn: (() => void) | undefined;
    let mounted = true;

    const setupSubscription = async () => {
      try {
        const authProvider = await getAuthProvider();

        if (!mounted) return;

        unsubscribeFn = authProvider.onAuthStateChanged((newUser) => {
          if (!mounted) return;

          setUser(newUser);

          if (newUser) {
            logger.setUser({
              id: newUser.id,
              email: newUser.email,
              name: newUser.name,
            });
            logger.auth("Auth state changed - user authenticated", {
              userId: newUser.id,
            });
          } else {
            logger.clearUser();
            logger.auth("Auth state changed - user logged out");
          }

          setIsLoading(false);
        });
      } catch (error) {
        const errorInstance = error instanceof Error ? error : new Error(String(error));
        logger.error("Failed to setup auth subscription", errorInstance);
      }
    };

    void setupSubscription();

    return () => {
      mounted = false;
      if (unsubscribeFn) {
        unsubscribeFn();
      }
    };
  }, []);

  const login = async (redirectPath?: string): Promise<void> => {
    try {
      setIsLoading(true);
      logger.auth("Login attempt started", { redirectPath });

      const authProvider = await getAuthProvider();
      await authProvider.login({
        redirectPath,
      });
    } catch (error) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));

      logger.error("Login failed", errorInstance, {
        redirectPath,
        timestamp: new Date().toISOString(),
      });
      setIsLoading(false);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    const userId = user?.id;
    try {
      setIsLoading(true);
      logger.auth("Logout attempt started", { userId });

      logger.clearUser();

      const authProvider = await getAuthProvider();
      // No override — let the provider use its configured post-logout redirect
      // (OIDC_POST_LOGOUT_REDIRECT_URI from runtime config).
      await authProvider.logout();
    } catch (error) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));

      logger.error("Logout failed", errorInstance, {
        userId,
        timestamp: new Date().toISOString(),
      });
      setIsLoading(false);
      throw error;
    }
  };

  const getAccessToken = async (): Promise<string | null | undefined> => {
    const userId = user?.id;
    try {
      const authProvider = await getAuthProvider();
      const token = await authProvider.getAccessToken();

      if (token) {
        logger.auth("Token acquired successfully", { userId });
      }

      return token;
    } catch (error) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));

      logger.error("Token acquisition failed", errorInstance, { userId });
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    whenReady,
    login,
    logout,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
