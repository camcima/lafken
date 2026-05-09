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
}

const FLUSH_INTERVAL_MS = 50;

export function installInMemoryMetricReader(): IMetricReaderHandle {
  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const provider = new MeterProvider({
    readers: [
      new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: FLUSH_INTERVAL_MS }),
    ],
  });
  metrics.setGlobalMeterProvider(provider);
  return {
    exporter,
    provider,
    async forceFlush() {
      await provider.forceFlush();
    },
    async shutdown() {
      await provider.shutdown();
      metrics.disable();
    },
  };
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
