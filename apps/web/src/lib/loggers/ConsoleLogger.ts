/* eslint-disable no-console */
import { AuthUser } from "@/lib/auth/interface/IAuthProvider";
import { ILogger } from "@/lib/logger";

export class ConsoleLogger implements ILogger {
  private context: Record<string, unknown> = {};

  info(message: string, extra?: Record<string, unknown>): void {
    this.logToDevelopmentConsole("INFO", message, undefined, extra);
  }

  debug(message: string, extra?: Record<string, unknown>): void {
    this.logToDevelopmentConsole("DEBUG", message, undefined, extra);
  }

  error(message: string, error?: Error, extra?: Record<string, unknown>): void {
    this.logToDevelopmentConsole("ERROR", message, error, extra);
  }

  warn(message: string, extra?: Record<string, unknown>): void {
    this.logToDevelopmentConsole("WARN", message, undefined, extra);
  }

  setContext(key: string, context: Record<string, unknown>): void {
    this.context[key] = context;
    this.logToDevelopmentConsole(
      "CONTEXT",
      `Context ${key} set: ${JSON.stringify(context)}`,
      undefined,
      this.context,
    );
  }

  auth(event: string, details?: Record<string, unknown>): void {
    this.logToDevelopmentConsole("AUTH", event, null, details);
  }

  performance(metric: string, value: number, unit?: string): void {
    this.logToDevelopmentConsole("PERFORMANCE", `${metric}: ${value}${unit}`);
  }

  setUser(user: AuthUser): void {
    this.logToDevelopmentConsole("USER", JSON.stringify(user), null, this.context);
  }

  clearUser(): void {
    this.context = {};
  }

  private getConsoleMethod(level: string): typeof console.log {
    switch (level.toLowerCase()) {
      case "error":
        return console.error;
      case "warn":
        return console.warn;
      case "info":
        return console.info;
      case "debug":
        return console.debug;
      default:
        return console.log;
    }
  }

  private logToDevelopmentConsole(
    level: string,
    message: string,
    error?: Error | null,
    extra?: Record<string, unknown>,
  ): void {
    const logMethod = this.getConsoleMethod(level);

    logMethod(`[${level}] ${message}`, error, extra);
  }
}
