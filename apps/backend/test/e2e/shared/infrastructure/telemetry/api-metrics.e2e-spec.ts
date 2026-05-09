import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type IMetricReaderHandle,
  installInMemoryMetricReader,
} from "../../../../__mocks__/in-memory-metric-reader";
import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

/**
 * Confirms that HTTP server-side request duration metrics are emitted in the
 * runtime, satisfying the v1.0 §5.3 `lafken.api.request.duration` slot. In this
 * codebase the metric is produced by `@opentelemetry/instrumentation-http`
 * (auto-instrumentation) under `http.server.duration` /
 * `http.server.request.duration` rather than by nestjs-otel itself, since
 * nestjs-otel 8.x does not ship its own `apiMetrics` option.
 *
 * The reader must be installed BEFORE `createAppModuleForE2ETest()` because
 * any module that imports `metrics.ts` caches its instruments against the
 * MeterProvider that was active at module-load time.
 */
describe("[E2E] HTTP server metrics emission (http.server.*)", () => {
  let app: INestApplication;
  let reader: IMetricReaderHandle;

  beforeAll(async () => {
    reader = installInMemoryMetricReader();
    reader.reset();
    const fixture = await createAppModuleForE2ETest();
    app = fixture.appFixture;
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("emits at least one `http.server.*` metric after a request lands", async () => {
    // Health is public; no auth required, no DB seeding. It is enough to make
    // the http instrumentation tick.
    await request(app.getHttpServer()).get("/health");

    await reader.forceFlush();

    const collected = reader.exporter.getMetrics();
    const metricNames: string[] = collected.flatMap((batch) =>
      batch.scopeMetrics.flatMap((scope) =>
        scope.metrics.map((descriptor) => descriptor.descriptor.name),
      ),
    );

    const httpServerMetric = metricNames.find((name) => name.startsWith("http.server."));
    expect(
      httpServerMetric,
      `expected at least one metric whose name starts with "http.server.", saw: ${JSON.stringify(metricNames)}`,
    ).toBeDefined();
  });
});
