/* v8 ignore file */
import { Injectable, type NestMiddleware } from "@nestjs/common";
import { type Histogram, metrics, ValueType } from "@opentelemetry/api";
import type { NextFunction, Request, Response } from "express";

import { apiRequestDurationHistogram } from "./metrics";

const NS_PER_MS = 1_000_000;

/**
 * Records HTTP server request duration histograms for every incoming request,
 * scoped under the same `lafken` meter as our domain instruments. nestjs-otel
 * 8.x dropped its built-in `apiMetrics` middleware, and the
 * `@opentelemetry/instrumentation-http` auto-instrumentation only runs when
 * the OTel SDK is bootstrapped at process start (production-only).
 *
 * This middleware closes the gap so the v1.0 §5.3 `lafken.api.request.duration`
 * slot is populated in every environment where the app boots — including
 * tests — and so dashboards keyed on the standard semantic-convention metric
 * name `http.server.duration` continue to work.
 *
 * Attribute keys used here (`route`, `status`) belong to the project's
 * closed allow-list defined in `metrics.ts`. Banned high-cardinality keys
 * (`url`, `ip`, `request_id`, `trace_id`, etc.) are deliberately not emitted.
 */
@Injectable()
export class ApiMetricsMiddleware implements NestMiddleware {
  private readonly httpServerDurationHistogram: Histogram = metrics
    .getMeter("lafken")
    .createHistogram("http.server.duration", {
      description: "HTTP server request duration in milliseconds",
      unit: "ms",
      valueType: ValueType.DOUBLE,
    });

  use(req: Request, res: Response, next: NextFunction): void {
    const startedAt: bigint = process.hrtime.bigint();
    res.on("finish", (): void => {
      const elapsedNs: bigint = process.hrtime.bigint() - startedAt;
      const elapsedMs: number = Number(elapsedNs) / NS_PER_MS;
      const attributes: Record<string, string | number> = {
        route: (req.route as { path?: string } | undefined)?.path ?? "unmatched",
        status: res.statusCode,
      };
      this.httpServerDurationHistogram.record(elapsedMs, attributes);
      apiRequestDurationHistogram.record(elapsedMs, attributes);
    });
    next();
  }
}
