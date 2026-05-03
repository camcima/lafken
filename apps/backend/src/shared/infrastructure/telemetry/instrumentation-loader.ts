/* v8 ignore file */
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

import { isNil } from "@/shared/utils/misc.utils";

import { environmentConfiguration } from "../environment.configuration";

export function loadInstrumentation(): void {
  const serviceName = environmentConfiguration.OTEL_SERVICE_NAME;
  const otlpUrl = environmentConfiguration.OTEL_EXPORTER_OTLP_ENDPOINT;

  const canLoadTraces = !isNil(serviceName) && !isNil(otlpUrl);

  if (!canLoadTraces) {
    return;
  }

  let spanProcessor: BatchSpanProcessor | undefined;

  if (canLoadTraces) {
    const traceExporter = new OTLPTraceExporter({
      url: otlpUrl,
    });

    spanProcessor = new BatchSpanProcessor(traceExporter, {
      maxQueueSize: 500,
      scheduledDelayMillis: 5_000,
    });
  }

  const otelSDK = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    spanProcessor,
    contextManager: new AsyncLocalStorageContextManager(),
    sampler: new ParentBasedSampler({
      // eslint-disable-next-line no-magic-numbers
      root: new TraceIdRatioBasedSampler(0.1),
    }),
    textMapPropagator: new CompositePropagator({
      propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
    }),
    instrumentations: [
      new PinoInstrumentation({
        enabled: true,
        logKeys: {
          traceId: "trace_id",
          spanId: "span_id",
          traceFlags: "trace_flags",
        },
      }),
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-http": {
          enabled: true,
          ignoreIncomingRequestHook: (req) => {
            const url = req.url || "";
            return url.includes("/openapi") || url.includes("health");
          },
        },
        "@opentelemetry/instrumentation-pino": {
          logHook: (_span, logRecord) => {
            logRecord[ATTR_SERVICE_NAME] = serviceName;
          },
        },
      }),
    ],
  });

  otelSDK.start();

  process.once("SIGTERM", () => {
    void otelSDK
      .shutdown()
      .then(
        // eslint-disable-next-line no-console
        () => console.debug("SDK shut down successfully"),
        // eslint-disable-next-line no-console
        (err) => console.error("Error shutting down SDK", err),
      )
      .finally(() => process.exit(0));
  });
}
