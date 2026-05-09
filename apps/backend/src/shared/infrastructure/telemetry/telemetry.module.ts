import { Module } from "@nestjs/common";
import { OpenTelemetryModule } from "nestjs-otel";

/**
 * Wires nestjs-otel into the Nest container. `hostMetrics: true` enables host
 * resource metrics (CPU/memory/event loop) via `@opentelemetry/host-metrics`.
 *
 * NOTE on HTTP request metrics: nestjs-otel 8.x does not ship an `apiMetrics`
 * option. HTTP server-side request duration is emitted by
 * `ApiMetricsMiddleware` (registered in `AppModule`) under both the v1.0
 * Lafken spec name `lafken.api.request.duration` and the semantic-convention
 * name `http.server.duration`. In production the OTel SDK in
 * `instrumentation-loader.ts` additionally wires
 * `@opentelemetry/instrumentation-http`, which independently emits
 * `http.server.duration` from the Node HTTP layer.
 */
@Module({
  imports: [
    OpenTelemetryModule.forRoot({
      metrics: {
        hostMetrics: true,
      },
    }),
  ],
  providers: [],
})
export class TelemetryModule {}
