# Observability & Telemetry

**Applies to**: backend, web

## Stack Overview

| Layer          | Tool                                                              | Purpose                                   |
| -------------- | ----------------------------------------------------------------- | ----------------------------------------- |
| **Backend**    | OpenTelemetry (`@opentelemetry/*`, `nestjs-otel`)                 | Distributed tracing, custom spans         |
| **Frontend**   | Grafana Faro (`@grafana/faro-react`, `@grafana/faro-web-tracing`) | RUM, error tracking, tracing, performance |
| **Collection** | Grafana Faro Collector → Grafana Cloud                            | Aggregation and visualization             |

## Frontend (Grafana Faro)

### Initialization

Faro is initialized once after authentication via the `withMonitoring` HOC:

```typescript
// src/lib/monitoring/faro.ts
initializeFaro({
  url: getRuntimeValue("MONITORING_URL"),
  user: { id: user.id, email: user.email, username: user.name, roles: user.roles?.join(", ") },
  instrumentations: [
    ...getWebInstrumentations({ captureConsole: true }),
    new TracingInstrumentation(),
  ],
  app: { name: "eMantto Template", version: "1.0.0", environment: getRuntimeValue("ENVIRONMENT") },
});
```

### withMonitoring HOC

```typescript
// src/components/withMonitoring/index.tsx
const AuthMonitoredGuard = withMonitoring(AuthGuard);
```

- Wraps any component to ensure Faro initializes when the user authenticates
- Initializes exactly once (idempotent)
- Shows loading spinner during initialization

### What Faro Captures

- **Errors**: Unhandled exceptions, console errors
- **Web Vitals**: LCP, FID, CLS, TTFB
- **Traces**: Distributed tracing via `TracingInstrumentation` (propagates trace context to Backend)
- **Custom Events**: Auth events via `faro.api.pushEvent()`
- **Custom Metrics**: Performance measurements via `faro.api.pushMeasurement()`

## Backend (OpenTelemetry)

- `nestjs-otel` provides automatic instrumentation for NestJS HTTP handlers
- `@opentelemetry/*` packages handle trace propagation and span creation
- Correlation IDs flow: Frontend (Faro) → Backend via trace context headers

## Rules

- **Faro initialization requires `MONITORING_URL`** — if empty, initialization is skipped (graceful no-op)
- **Never initialize Faro before authentication** — user context is required
- **Use `logger.performance()`** for custom timing metrics, not direct Faro API calls
- **Console capture** is enabled but filtered: `LOG`, `INFO`, `DEBUG`, `TRACE` levels are excluded to reduce noise
