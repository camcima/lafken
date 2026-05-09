/* v8 ignore file */
import { type MeterProvider, metrics } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from "@opentelemetry/core";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  PeriodicExportingMetricReader,
  MeterProvider as SdkMeterProvider,
} from "@opentelemetry/sdk-metrics";
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

  let meterProvider: MeterProvider | undefined;
  if (canLoadTraces && environmentConfiguration.OTEL_METRICS_ENABLED) {
    const metricExporter = new OTLPMetricExporter({ url: otlpUrl });
    const sdkMeterProvider = new SdkMeterProvider({
      resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: serviceName }),
      readers: [
        new PeriodicExportingMetricReader({
          exporter: metricExporter,
          exportIntervalMillis: 10_000,
        }),
      ],
    });
    metrics.setGlobalMeterProvider(sdkMeterProvider);
    meterProvider = sdkMeterProvider;
  }

  process.once("SIGTERM", () => {
    void (async (): Promise<void> => {
      try {
        await otelSDK.shutdown();
        if (meterProvider && "shutdown" in meterProvider) {
          await (meterProvider as SdkMeterProvider).shutdown();
        }
        // eslint-disable-next-line no-console
        console.debug("SDK shut down successfully");
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error shutting down SDK", err);
      } finally {
        process.exit(0);
      }
    })();
  });
}
