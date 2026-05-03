import { getRuntimeValue } from "@/config/app-config";

import { ConsoleLogger } from "./loggers/ConsoleLogger";
import { FaroLogger } from "./loggers/FaroLogger";

/**
 * Centralized logging utility
 * Uses Grafana Faro in production, console in development
 */

export interface ILogger {
  error(message: string, error?: Error, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  debug(message: string, extra?: Record<string, unknown>): void;
  auth(event: string, details?: Record<string, unknown>): void;
  performance(metric: string, value: number, unit?: string): void;
  setUser(user: { id: string; email?: string; name?: string }): void;
  clearUser(): void;
  setContext?(key: string, context: Record<string, unknown>): void;
}

const LogProviderMapping = {
  Intg: ConsoleLogger,
  Prod: FaroLogger,
} as const;

const isIntegration = getRuntimeValue("ENVIRONMENT") === "intg";
const env = isIntegration ? "Intg" : "Prod";
const logProvider: ILogger = new LogProviderMapping[env]();

const error = logProvider.error.bind(logProvider);
const warn = logProvider.warn.bind(logProvider);
const info = logProvider.info.bind(logProvider);
const debug = logProvider.debug.bind(logProvider);
const auth = logProvider.auth.bind(logProvider);
const performance = logProvider.performance.bind(logProvider);
const setUser = logProvider.setUser.bind(logProvider);
const clearUser = logProvider.clearUser.bind(logProvider);
const setContext = logProvider.setContext?.bind(logProvider);

export const logger: ILogger = {
  error,
  warn,
  info,
  debug,
  auth,
  performance,
  setUser,
  clearUser,
  setContext,
};
