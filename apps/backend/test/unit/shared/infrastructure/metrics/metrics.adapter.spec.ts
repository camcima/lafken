import {
  type Counter,
  type Histogram,
  type ObservableGauge,
  metrics as otelMetrics,
} from "@opentelemetry/api";
import { describe, expect, it, vi } from "vitest";

import { OpenTelemetryMetricsAdapter } from "@/shared/infrastructure/metrics/metrics.adapter";

describe("OpenTelemetryMetricsAdapter", () => {
  it("records uploadIntentCreated with namespace_slug and protocol attributes", () => {
    const counter: Counter = { add: vi.fn() } as unknown as Counter;
    const meter = {
      createCounter: vi.fn().mockReturnValue(counter),
      createHistogram: vi.fn().mockReturnValue({ record: vi.fn() }),
      createObservableGauge: vi.fn().mockReturnValue({ addCallback: vi.fn() }),
    };
    vi.spyOn(otelMetrics, "getMeter").mockReturnValue(meter as never);

    const adapter = new OpenTelemetryMetricsAdapter();
    adapter.recordUploadIntentCreated({ namespaceSlug: "ns-1", protocol: "simple" });

    expect(counter.add).toHaveBeenCalledWith(1, {
      namespace_slug: "ns-1",
      protocol: "simple",
    });
  });

  it("records processingStepDuration on a histogram", () => {
    const histogram: Histogram = { record: vi.fn() } as unknown as Histogram;
    const meter = {
      createCounter: vi.fn().mockReturnValue({ add: vi.fn() }),
      createHistogram: vi.fn().mockReturnValue(histogram),
      createObservableGauge: vi.fn().mockReturnValue({ addCallback: vi.fn() }),
    };
    vi.spyOn(otelMetrics, "getMeter").mockReturnValue(meter as never);

    const adapter = new OpenTelemetryMetricsAdapter();
    adapter.recordProcessingStepDuration({
      step: "virus_scan",
      decision: "pass",
      durationMs: 234,
    });

    expect(histogram.record).toHaveBeenCalledWith(234, {
      step: "virus_scan",
      decision: "pass",
    });
  });

  it("registers a queue-depth observable gauge callback", () => {
    const addCallback = vi.fn();
    const gauge: ObservableGauge = { addCallback } as unknown as ObservableGauge;
    const meter = {
      createCounter: vi.fn().mockReturnValue({ add: vi.fn() }),
      createHistogram: vi.fn().mockReturnValue({ record: vi.fn() }),
      createObservableGauge: vi.fn().mockReturnValue(gauge),
    };
    vi.spyOn(otelMetrics, "getMeter").mockReturnValue(meter as never);

    const adapter = new OpenTelemetryMetricsAdapter();
    const sampler = vi.fn().mockResolvedValue(7);
    adapter.registerQueueDepthSampler(sampler);

    expect(addCallback).toHaveBeenCalledTimes(1);
  });
});
