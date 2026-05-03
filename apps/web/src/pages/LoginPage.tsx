import { Navigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";

import { LoginWelcome } from "@/components/auth/LoginWelcome";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";

export default function LoginPage() {
  const { isAuthenticated } = useAuth();
  const { redirect } = useSearch({ from: "/auth/login" });

  useEffect(() => {
    logger.auth("Login page accessed", { redirect });
    if (isAuthenticated) {
      logger.auth("User already authenticated, redirecting", { redirect });
    }
  }, [isAuthenticated, redirect]);

  if (isAuthenticated) {
    return <Navigate to={redirect} />;
  }

  return <LoginWelcome redirectPath={redirect} />;
}
