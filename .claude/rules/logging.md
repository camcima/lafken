# Logging Standards

## Library & Interface

- Use `nestjs-pino` via `AppLoggerPort` abstract class (bound to `PinoLogger`)
- Logger module at `src/shared/infrastructure/logger/`
- Call `appLogger.setContext(TargetClass.name)` when injecting into a service

```typescript
// Port definition
export abstract class AppLoggerPort {
  abstract debug(msg: string, ...args: any[]): void;
  abstract debug(obj: unknown, msg?: string, ...args: any[]): void;
  abstract info(msg: string, ...args: any[]): void;
  abstract info(obj: unknown, msg?: string, ...args: any[]): void;
  abstract warn(msg: string, ...args: any[]): void;
  abstract warn(obj: unknown, msg?: string, ...args: any[]): void;
  abstract error(msg: string, ...args: any[]): void;
  abstract error(obj: unknown, msg?: string, ...args: any[]): void;
  abstract setContext(value: string): void;
}
```

## Output Format by Environment

| Environment                     | Format                           |
| ------------------------------- | -------------------------------- |
| `development`                   | Human-readable via `pino-pretty` |
| `test`, `staging`, `production` | Structured JSON                  |

Log level configurable via `LOG_LEVEL` environment variable.

## Mandatory Rules

- **No `console.*`** usage - use `AppLoggerPort` exclusively
- **No alternative logging libraries** - only Pino via the port
- **Correlation/Request IDs** required for all request-scoped logs (FE <-> Backend tracing)
- **Log levels**: `trace`, `debug`, `info`, `warn`, `error`, `fatal`

## PII & Secret Redaction (CRITICAL)

- **NEVER** log secrets, credentials, tokens, or PII (emails, passport numbers, credit cards)
- Configure Pino redaction for sensitive headers: `['req.headers.authorization']`
- Include request IDs, user IDs, module/service names as structured metadata
- If logging user-related data, mask it: `email: "j***@example.com"`

## Context & Metadata

Always include structured context in log entries:

```typescript
this.logger.info(
  {
    correlationId: requestContext.correlationId,
    userId: requestContext.userId,
    action: "registerUser",
  },
  "User registration started",
);
```
