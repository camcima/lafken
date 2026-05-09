import { metrics } from "@opentelemetry/api";
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";

export interface IMetricReaderHandle {
  exporter: InMemoryMetricExporter;
  provider: MeterProvider;
  forceFlush(): Promise<void>;
  shutdown(): Promise<void>;
  /** Clears collected data without tearing down the provider. */
  reset(): void;
}

const FLUSH_INTERVAL_MS = 50;

/**
 * Installs an in-memory `MeterProvider` as the global one. Idempotent: if a
 * reader has already been installed in this process, returns the existing
 * handle instead of swapping the provider. This is important because instruments
 * created off `metrics.getMeter()` are bound to the provider that was active at
 * module-load time — installing a fresh provider mid-test would silently
 * detach existing instruments and emit zero data points.
 *
 * Production code should never call this; the unit-test setup file installs it
 * once at startup, and individual specs call it again to obtain the handle.
 */
let activeHandle: IMetricReaderHandle | null = null;

export function installInMemoryMetricReader(): IMetricReaderHandle {
  if (activeHandle !== null) {
    return activeHandle;
  }
  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const provider = new MeterProvider({
    readers: [
      new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: FLUSH_INTERVAL_MS }),
    ],
  });
  metrics.setGlobalMeterProvider(provider);
  const handle: IMetricReaderHandle = {
    exporter,
    provider,
    async forceFlush() {
      await provider.forceFlush();
    },
    async shutdown() {
      await provider.shutdown();
      metrics.disable();
      activeHandle = null;
    },
    reset() {
      exporter.reset();
    },
  };
  activeHandle = handle;
  return handle;
}

export function findCounterPoint(
  exporter: InMemoryMetricExporter,
  name: string,
  attrs: Record<string, string | number | boolean> = {},
): { value: number; attributes: Record<string, unknown> } | undefined {
  const batches = exporter.getMetrics();
  for (const batch of batches) {
    for (const scope of batch.scopeMetrics) {
      for (const metric of scope.metrics) {
        if (metric.descriptor.name !== name) continue;
        for (const point of metric.dataPoints) {
          const matches = Object.entries(attrs).every(
            ([key, value]) => (point.attributes as Record<string, unknown>)[key] === value,
          );
          if (matches) {
            return { value: point.value as number, attributes: point.attributes };
          }
        }
      }
    }
  }
  return undefined;
}
