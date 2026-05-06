import { AppLoggerPort } from "@/shared/application/app-logger.port";

/**
 * In-memory AppLoggerPort double used in unit tests. No-op by default; we don't
 * assert log output in these specs (logging is for operators, not contracts).
 */
export class FakeAppLogger extends AppLoggerPort {
  context: string | null = null;

  setContext(value: string): void {
    this.context = value;
  }

  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}
