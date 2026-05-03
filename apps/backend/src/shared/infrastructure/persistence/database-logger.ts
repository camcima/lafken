import { AppLoggerPort } from "@/shared/application/app-logger.port";

import { environmentConfiguration } from "../environment.configuration";

export class DatabaseLogger {
  constructor(private readonly appLogger: AppLoggerPort) {}

  /**
   * Logs query metadata (SQL + param count) by default. Raw parameter values
   * may contain PII, tokens, or other sensitive business data and are only
   * emitted when NODE_ENV === "development".
   */
  logQuery(query: string, params: unknown[] | readonly unknown[]) {
    const paramCount = params?.length ?? 0;
    const isDevelopment = environmentConfiguration.NODE_ENV === "development";

    if (!isDevelopment) {
      this.appLogger.debug(`Query: ${query} | Params: <redacted, count=${paramCount}>`);
      return;
    }

    if (paramCount === 0) {
      this.appLogger.debug(`Query: ${query}`);
      return;
    }

    try {
      this.appLogger.debug(`Query: ${query} | Params: ${JSON.stringify(params)}`);
    } catch {
      // JSON.stringify can throw on circular refs; fall back to a safe form.
      this.appLogger.debug(`Query: ${query} | Params: <unserializable, count=${paramCount}>`);
    }
  }
}
