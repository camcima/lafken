/* eslint-disable no-console */
import { faro as faroInstance, LogLevel } from "@grafana/faro-react";

import { AuthUser } from "@/lib/auth/interface/IAuthProvider";
import { ILogger } from "@/lib/logger";

export class FaroLogger implements ILogger {
  error(message: string, error?: Error, extra?: Record<string, unknown>): void {
    const api = this.getFaroInstance();
    if (api) {
      api.pushError(error ?? new Error(message), {
        context: { message, ...extra },
      });
      return;
    }
    console.error("[ERROR]", message, error, extra);
  }

  warn(message: string, extra?: Record<string, unknown>): void {
    const api = this.getFaroInstance();
    if (api) {
      api.pushLog([message], {
        level: LogLevel.WARN,
        context: extra as Record<string, string>,
      });
      return;
    }
    console.warn("[WARN]", message, extra);
  }

  info(message: string, extra?: Record<string, unknown>): void {
    const api = this.getFaroInstance();
    if (api) {
      api.pushLog([message], {
        level: LogLevel.INFO,
        context: extra as Record<string, string>,
      });
      return;
    }
    console.info("[INFO]", message, extra);
  }

  debug(message: string, extra?: Record<string, unknown>): void {
    const api = this.getFaroInstance();
    if (api) {
      api.pushLog([message], {
        level: LogLevel.DEBUG,
        context: extra as Record<string, string>,
      });
      return;
    }
    console.debug("[DEBUG]", message, extra);
  }

  auth(event: string, details?: Record<string, unknown>): void {
    const api = this.getFaroInstance();
    if (api) {
      api.pushEvent(LogLevel.INFO, { event, ...details });
      return;
    }
    console.info("[AUTH]", event, details);
  }

  performance(metric: string, value: number, unit?: string): void {
    this.getFaroInstance()?.pushMeasurement({
      type: "web-vital",
      values: { [metric]: value },
      context: {
        [metric]: unit ?? "ms",
      },
    });
  }

  setUser(user: AuthUser): void {
    this.getFaroInstance()?.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
      roles: user.roles?.join(", "),
    });
  }

  clearUser(): void {
    this.getFaroInstance()?.setUser(undefined);
  }

  private getFaroInstance() {
    if ("api" in faroInstance) {
      return faroInstance.api;
    }

    return null;
  }
}
