import { type Counter, metrics } from "@opentelemetry/api";

/**
 * Closed allow-list of attribute keys we permit on any Lafken metric. Adding a
 * key here is a deliberate cardinality decision — never include user emails,
 * raw URLs, asset ids, or any other unbounded value. The unit-test guard in
 * `metrics.spec.ts` enforces that all `add(...)` / `record(...)` call sites
 * stick to this list.
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
  UPLOAD_INTENT_CREATED: "lafken.upload.intent.created",
} as const;

const meter = metrics.getMeter("lafken");

export const uploadIntentCreatedCounter: Counter = meter.createCounter(
  LAFKEN_METRIC_NAMES.UPLOAD_INTENT_CREATED,
  {
    description: "Number of upload intents created",
  },
);
