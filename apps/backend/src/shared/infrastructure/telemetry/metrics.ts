import { type Counter, type Histogram, metrics, type ObservableGauge } from "@opentelemetry/api";

/**
 * Closed allow-list of attribute keys we permit on any Lafken metric. See
 * §5.2 of the v1.0 re-baseline design — no asset ids, user emails, raw URLs,
 * or anything else with unbounded cardinality.
 */
export const ALLOWED_METRIC_ATTRIBUTE_KEYS = [
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
] as const;

export type LafkenMetricAttributeKey = (typeof ALLOWED_METRIC_ATTRIBUTE_KEYS)[number];

export const LAFKEN_METRIC_NAMES = {
  // Upload
  UPLOAD_INTENT_CREATED: "lafken.upload.intent.created",
  UPLOAD_INTENT_REFRESHED: "lafken.upload.intent.refreshed",
  UPLOAD_CONFIRMED: "lafken.upload.confirmed",
  UPLOAD_INTENT_EXPIRED_SWEPT: "lafken.upload.intent.expired_swept",
  // Pipeline
  PROCESSING_JOB_CLAIMED: "lafken.processing.job.claimed",
  PROCESSING_JOB_RELEASED: "lafken.processing.job.released",
  PROCESSING_STEP_DURATION: "lafken.processing.step.duration",
  PROCESSING_STEP_OUTCOME: "lafken.processing.step.outcome",
  PROCESSING_RETRY: "lafken.processing.retry",
  PROCESSING_WORKFLOW_TIMEOUT: "lafken.processing.workflow_timeout",
  PROCESSING_TERMINAL_STATE: "lafken.processing.terminal_state",
  PROCESSING_QUEUE_DEPTH: "lafken.processing.queue_depth",
  PROCESSING_STALE_CLAIM_RECLAIMED: "lafken.processing.stale_claim_reclaimed",
  // Serving
  SERVING_PREVIEW_URL_ISSUED: "lafken.serving.preview_url.issued",
  SERVING_PREVIEW_URL_DURATION: "lafken.serving.preview_url.duration",
  SERVING_DOWNLOAD_URL_ISSUED: "lafken.serving.download_url.issued",
  // Authorization
  AUTHZ_DECISION: "lafken.authz.decision",
  // API (also emitted by nestjs-otel http instrumentation)
  API_REQUEST_DURATION: "lafken.api.request.duration",
} as const;

const meter = metrics.getMeter("lafken");

// Upload
export const uploadIntentCreatedCounter: Counter = meter.createCounter(
  LAFKEN_METRIC_NAMES.UPLOAD_INTENT_CREATED,
  { description: "Number of upload intents created" },
);
export const uploadIntentRefreshedCounter: Counter = meter.createCounter(
  LAFKEN_METRIC_NAMES.UPLOAD_INTENT_REFRESHED,
  { description: "Number of upload intent URL refreshes issued" },
);
export const uploadConfirmedCounter: Counter = meter.createCounter(
  LAFKEN_METRIC_NAMES.UPLOAD_CONFIRMED,
  { description: "Number of uploads confirmed and promoted to assets" },
);
export const uploadIntentExpiredSweptCounter: Counter = meter.createCounter(
  LAFKEN_METRIC_NAMES.UPLOAD_INTENT_EXPIRED_SWEPT,
  { description: "Number of orphan upload intents expired by the sweeper" },
);

// Pipeline
export const processingJobClaimedCounter: Counter = meter.createCounter(
  LAFKEN_METRIC_NAMES.PROCESSING_JOB_CLAIMED,
  { description: "Number of processing jobs claimed by a worker" },
);
export const processingJobReleasedCounter: Counter = meter.createCounter(
  LAFKEN_METRIC_NAMES.PROCESSING_JOB_RELEASED,
  { description: "Number of processing jobs released back to the queue (with reason)" },
);
export const processingStepDurationHistogram: Histogram = meter.createHistogram(
  LAFKEN_METRIC_NAMES.PROCESSING_STEP_DURATION,
  { description: "Duration of a processing pipeline step in milliseconds", unit: "ms" },
);
export const processingStepOutcomeCounter: Counter = meter.createCounter(
  LAFKEN_METRIC_NAMES.PROCESSING_STEP_OUTCOME,
  { description: "Outcome of a processing pipeline step (with step, decision)" },
);
export const processingRetryCounter: Counter = meter.createCounter(
  LAFKEN_METRIC_NAMES.PROCESSING_RETRY,
  { description: "Number of processing retries (with error_class)" },
);
export const processingWorkflowTimeoutCounter: Counter = meter.createCounter(
  LAFKEN_METRIC_NAMES.PROCESSING_WORKFLOW_TIMEOUT,
  { description: "Number of workflow-timeout terminations" },
);
export const processingTerminalStateCounter: Counter = meter.createCounter(
  LAFKEN_METRIC_NAMES.PROCESSING_TERMINAL_STATE,
  { description: "Number of assets reaching a terminal processing state (with state)" },
);
export const processingQueueDepthGauge: ObservableGauge = meter.createObservableGauge(
  LAFKEN_METRIC_NAMES.PROCESSING_QUEUE_DEPTH,
  { description: "Sampled depth of the processing queue (released or due jobs)" },
);
export const processingStaleClaimReclaimedCounter: Counter = meter.createCounter(
  LAFKEN_METRIC_NAMES.PROCESSING_STALE_CLAIM_RECLAIMED,
  { description: "Number of stale processing claims reclaimed by the sweeper" },
);

// Serving
export const previewUrlIssuedCounter: Counter = meter.createCounter(
  LAFKEN_METRIC_NAMES.SERVING_PREVIEW_URL_ISSUED,
  { description: "Number of signed preview URLs minted (with namespace_slug, preset_name)" },
);
export const previewUrlDurationHistogram: Histogram = meter.createHistogram(
  LAFKEN_METRIC_NAMES.SERVING_PREVIEW_URL_DURATION,
  { description: "Duration of preview-url issuance in milliseconds", unit: "ms" },
);
export const downloadUrlIssuedCounter: Counter = meter.createCounter(
  LAFKEN_METRIC_NAMES.SERVING_DOWNLOAD_URL_ISSUED,
  { description: "Number of signed download URLs minted" },
);

// Authorization
export const authzDecisionCounter: Counter = meter.createCounter(
  LAFKEN_METRIC_NAMES.AUTHZ_DECISION,
  { description: "Authorization decisions (with action, result)" },
);

// API
// NOTE: `lafken.api.request.duration` is the v1.0 spec name. nestjs-otel 8.x
// dropped its built-in `apiMetrics` middleware, so we record the histogram
// ourselves from `ApiMetricsMiddleware` (alongside the standard
// semantic-convention metric `http.server.duration`). When the OTel SDK is
// bootstrapped at process start in production, `instrumentation-loader.ts`
// also wires `@opentelemetry/instrumentation-http`, which emits the same
// `http.server.duration` independently.
export const apiRequestDurationHistogram: Histogram = meter.createHistogram(
  LAFKEN_METRIC_NAMES.API_REQUEST_DURATION,
  {
    description:
      "HTTP request duration in milliseconds (also emitted as the semconv name `http.server.duration` from ApiMetricsMiddleware)",
    unit: "ms",
  },
);
