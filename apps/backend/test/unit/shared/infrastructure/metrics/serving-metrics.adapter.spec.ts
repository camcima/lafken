import { beforeEach, describe, expect, it } from "vitest";

import { OpenTelemetryMetricsAdapter } from "@/shared/infrastructure/metrics/metrics.adapter";
import { LAFKEN_METRIC_NAMES } from "@/shared/infrastructure/telemetry/metrics";

import {
  findCounterPoint,
  type IMetricReaderHandle,
  installInMemoryMetricReader,
} from "../../../../__mocks__/in-memory-metric-reader";

describe("OpenTelemetryMetricsAdapter serving metrics", () => {
  let handle: IMetricReaderHandle;
  let adapter: OpenTelemetryMetricsAdapter;

  beforeEach(() => {
    handle = installInMemoryMetricReader();
    handle.reset();
    adapter = new OpenTelemetryMetricsAdapter();
  });

  it("emits lafken.serving.preview_url.issued with namespace_slug + preset_name", async () => {
    adapter.recordPreviewUrlIssued({ namespaceSlug: "ns-a", presetName: "lafken:thumbnail" });

    await handle.forceFlush();

    expect(
      findCounterPoint(handle.exporter, LAFKEN_METRIC_NAMES.SERVING_PREVIEW_URL_ISSUED, {
        namespace_slug: "ns-a",
        preset_name: "lafken:thumbnail",
      })?.value,
    ).toBe(1);
  });

  it("emits lafken.serving.download_url.issued with namespace_slug", async () => {
    adapter.recordDownloadUrlIssued({ namespaceSlug: "ns-b" });

    await handle.forceFlush();

    expect(
      findCounterPoint(handle.exporter, LAFKEN_METRIC_NAMES.SERVING_DOWNLOAD_URL_ISSUED, {
        namespace_slug: "ns-b",
      })?.value,
    ).toBe(1);
  });

  it("records preview-url duration without throwing", () => {
    expect(() =>
      adapter.recordPreviewUrlDuration({
        namespaceSlug: "ns-a",
        presetName: "lafken:thumbnail",
        durationMs: 42,
      }),
    ).not.toThrow();
  });
});
