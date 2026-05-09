import { describe, expect, it } from "vitest";

import {
  ALLOWED_METRIC_ATTRIBUTE_KEYS,
  LAFKEN_METRIC_NAMES,
  uploadIntentCreatedCounter,
} from "@/shared/infrastructure/telemetry/metrics";

describe("lafken metrics module", () => {
  it("exports the upload intent created counter under the lafken.* namespace", () => {
    expect(LAFKEN_METRIC_NAMES.UPLOAD_INTENT_CREATED).toBe("lafken.upload.intent.created");
    expect(uploadIntentCreatedCounter).toBeDefined();
    expect(typeof uploadIntentCreatedCounter.add).toBe("function");
  });

  it("documents the closed set of attribute keys allowed across instruments", () => {
    expect(ALLOWED_METRIC_ATTRIBUTE_KEYS).toEqual(
      expect.arrayContaining([
        "namespace_slug",
        "preset_name",
        "step",
        "decision",
        "error_class",
        "protocol",
        "reason",
        "state",
        "action",
        "result",
        "route",
        "status",
      ]),
    );
  });
});
