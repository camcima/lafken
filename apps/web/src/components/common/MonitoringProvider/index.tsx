import { PropsWithChildren, useEffect, useRef } from "react";

import { getRuntimeValue } from "@/config/app-config";
import { useAuth } from "@/hooks/useAuth";
import { initFaro } from "@/lib/monitoring/faro";

/**
 * Initializes Grafana Faro after authentication so user identity is
 * attached to every emitted span/log. Mounts under the protected
 * layout so the auth gate has already run; if MONITORING_URL is empty
 * this is a no-op and Faro never starts.
 */
export function MonitoringProvider({ children }: Readonly<PropsWithChildren>) {
  const { user } = useAuth();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!user || hasInitialized.current) return;
    hasInitialized.current = true;
    if (getRuntimeValue("MONITORING_URL").length > 0) {
      initFaro(user);
    }
  }, [user]);

  return <>{children}</>;
}
