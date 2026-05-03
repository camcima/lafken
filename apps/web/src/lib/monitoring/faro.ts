import { faro, getWebInstrumentations, initializeFaro, LogLevel } from "@grafana/faro-react";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";

import { getRuntimeValue } from "@/config/app-config";
import { AuthUser } from "@/lib/auth/interface/IAuthProvider";
import { maskEmail } from "@/lib/monitoring/maskPii";

export function initFaro(user: AuthUser) {
  if (!getRuntimeValue("MONITORING_URL").length || faro?.api) {
    return;
  }

  initializeFaro({
    url: getRuntimeValue("MONITORING_URL"),
    user: {
      id: user.id,
      email: maskEmail(user.email),
      roles: user.roles?.join(", "),
    },
    consoleInstrumentation: {
      consoleErrorAsLog: true,
      disabledLevels: [LogLevel.LOG, LogLevel.INFO, LogLevel.DEBUG, LogLevel.TRACE],
    },
    instrumentations: [
      ...getWebInstrumentations({
        captureConsole: true,
      }),
      new TracingInstrumentation(),
    ],
    app: {
      name: "eMantto Template",
      version: "1.0.0",
      environment: getRuntimeValue("ENVIRONMENT"),
    },
  });
}
