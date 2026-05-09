import { describe, expect, it } from "vitest";

import {
  ALLOWED_METRIC_ATTRIBUTE_KEYS,
  apiRequestDurationHistogram,
  authzDecisionCounter,
  downloadUrlIssuedCounter,
  LAFKEN_METRIC_NAMES,
  previewUrlDurationHistogram,
  previewUrlIssuedCounter,
  processingJobClaimedCounter,
  processingJobReleasedCounter,
  processingQueueDepthGauge,
  processingRetryCounter,
  processingStaleClaimReclaimedCounter,
  processingStepDurationHistogram,
  processingStepOutcomeCounter,
  processingTerminalStateCounter,
  processingWorkflowTimeoutCounter,
  uploadConfirmedCounter,
  uploadIntentCreatedCounter,
  uploadIntentExpiredSweptCounter,
  uploadIntentRefreshedCounter,
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

describe("lafken §5.3 instruments", () => {
  it("declares every named instrument with the expected name and shape", () => {
    expect(LAFKEN_METRIC_NAMES).toMatchObject({
      UPLOAD_INTENT_CREATED: "lafken.upload.intent.created",
      UPLOAD_INTENT_REFRESHED: "lafken.upload.intent.refreshed",
      UPLOAD_CONFIRMED: "lafken.upload.confirmed",
      UPLOAD_INTENT_EXPIRED_SWEPT: "lafken.upload.intent.expired_swept",
      PROCESSING_JOB_CLAIMED: "lafken.processing.job.claimed",
      PROCESSING_JOB_RELEASED: "lafken.processing.job.released",
      PROCESSING_STEP_DURATION: "lafken.processing.step.duration",
      PROCESSING_STEP_OUTCOME: "lafken.processing.step.outcome",
      PROCESSING_RETRY: "lafken.processing.retry",
      PROCESSING_WORKFLOW_TIMEOUT: "lafken.processing.workflow_timeout",
      PROCESSING_TERMINAL_STATE: "lafken.processing.terminal_state",
      PROCESSING_QUEUE_DEPTH: "lafken.processing.queue_depth",
      PROCESSING_STALE_CLAIM_RECLAIMED: "lafken.processing.stale_claim_reclaimed",
      SERVING_PREVIEW_URL_ISSUED: "lafken.serving.preview_url.issued",
      SERVING_PREVIEW_URL_DURATION: "lafken.serving.preview_url.duration",
      SERVING_DOWNLOAD_URL_ISSUED: "lafken.serving.download_url.issued",
      AUTHZ_DECISION: "lafken.authz.decision",
      API_REQUEST_DURATION: "lafken.api.request.duration",
    });

    expect(typeof uploadIntentRefreshedCounter.add).toBe("function");
    expect(typeof uploadConfirmedCounter.add).toBe("function");
    expect(typeof uploadIntentExpiredSweptCounter.add).toBe("function");
    expect(typeof processingJobClaimedCounter.add).toBe("function");
    expect(typeof processingJobReleasedCounter.add).toBe("function");
    expect(typeof processingStepDurationHistogram.record).toBe("function");
    expect(typeof processingStepOutcomeCounter.add).toBe("function");
    expect(typeof processingRetryCounter.add).toBe("function");
    expect(typeof processingWorkflowTimeoutCounter.add).toBe("function");
    expect(typeof processingTerminalStateCounter.add).toBe("function");
    expect(typeof processingStaleClaimReclaimedCounter.add).toBe("function");
    expect(typeof processingQueueDepthGauge.addCallback).toBe("function");
    expect(typeof previewUrlIssuedCounter.add).toBe("function");
    expect(typeof previewUrlDurationHistogram.record).toBe("function");
    expect(typeof downloadUrlIssuedCounter.add).toBe("function");
    expect(typeof authzDecisionCounter.add).toBe("function");
    expect(typeof apiRequestDurationHistogram.record).toBe("function");
  });

  it("never references an unbounded-cardinality attribute key in source", async () => {
    // Static guard: parse the source of metrics.ts and assert no banned key
    // appears as a literal. Catches refactors that wire `asset_id`, `user_id`,
    // `email`, `url`, etc. into an instrument's expected attributes.
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.resolve(__dirname, "../../../../../src/shared/infrastructure/telemetry/metrics.ts"),
      "utf8",
    );
    const banned = ["asset_id", "user_id", "email", "url", "ip", "request_id", "trace_id"];
    for (const key of banned) {
      expect(src.includes(`"${key}"`)).toBe(false);
    }
  });
});
