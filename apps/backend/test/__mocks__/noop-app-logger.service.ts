/* eslint-disable max-classes-per-file */
/* eslint-disable no-console */
import type { AppLoggerPort } from "../../src/shared/application/app-logger.port";

export class NoopApplicationLoggerMock implements AppLoggerPort {
  setContext(): void {}
  error(): void {}
  warn(): void {}
  debug(): void {}
  info(): void {}
}

export class NoopApplicationWithErrorLoggerMock implements AppLoggerPort {
  setContext(): void {}
  error(...args: any[]): void {
    console.error(...args);
  }
  warn(): void {}
  debug(): void {}
  info(): void {}
}
