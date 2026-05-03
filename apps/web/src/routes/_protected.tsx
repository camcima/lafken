import { createFileRoute, Navigate, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { MonitoringProvider } from "@/components/common/MonitoringProvider";
import Spinner from "@/components/common/Spinner";
import { ErrorBoundary } from "@/components/feedback/Error/ErrorBoundary";
import BootstrapRunner from "@/components/setup/runner";
import type { SetupStep } from "@/components/setup/types";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/layouts/AppShell";
import { buildRedirectTarget } from "@/lib/auth/validateRedirect";
import { healthService } from "@/services";

export const Route = createFileRoute("/_protected")({
  component: ProtectedLayout,
});

function ProtectedLayout() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/auth/login"
        search={{ redirect: buildRedirectTarget(location.pathname, location.searchStr) }}
        replace
      />
    );
  }

  const requiredSteps: SetupStep[] = [
    {
      id: "health",
      message: t("setup.health"),
      run: async () => {
        const ok = await healthService.isHealthy();
        if (!ok) {
          return {
            type: "failure",
            failed: true,
            errorTitle: t("common.healthyStatus.error"),
            errorDescription: t("common.healthyStatus.waiting"),
          };
        }

        return {
          type: "success",
          failed: false,
        };
      },
    },
  ];

  return (
    <ErrorBoundary>
      <MonitoringProvider>
        <BootstrapRunner steps={requiredSteps}>
          <AppShell />
        </BootstrapRunner>
      </MonitoringProvider>
    </ErrorBoundary>
  );
}
