import type { environmentConfiguration } from "../../src/shared/infrastructure/environment.configuration";
import { installInMemoryMetricReader } from "../__mocks__/in-memory-metric-reader";

// Install the in-memory metric reader once, before any module that touches the
// global Meter (i.e. metrics.ts) is imported. The instruments cached at module
// load time are bound to whichever provider is active at that moment, so the
// install must happen before metrics.ts is evaluated. Tests that want to assert
// on emitted metrics call `installInMemoryMetricReader()` again — it is
// idempotent and returns the same handle.
installInMemoryMetricReader();

vitest.mock(
  "../../src/shared/infrastructure/environment.configuration",
  (): { environmentConfiguration: typeof environmentConfiguration } => ({
    environmentConfiguration: {
      NODE_ENV: "test",
      APP_PORT: 3000,
      LOG_LEVEL: "info",
      PRETTY_LOGS: false,
      CORS_ALLOWED_ORIGINS: [],
      DB_HOST: "localhost",
      DB_PORT: 5432,
      DB_USER: "",
      DB_NAME: "",
      DB_PASSWORD: "",
      DB_SSL: false,
      DB_POOL_MIN: 1,
      DB_POOL_MAX: 200,
      DB_POOL_IDLE_TIMEOUT_MS: 30_000,
      DB_POOL_CONNECTION_TIMEOUT_MS: 30_000,
      DB_STATEMENT_TIMEOUT_MS: 60_000,
      DB_QUERY_TIMEOUT_MS: 60_000,
      DB_IDLE_IN_TX_TIMEOUT_MS: 100_000,
      OTEL_SERVICE_NAME: "",
      OTEL_RESOURCE_ATTRIBUTES: "",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://alloy:4317",
      OTEL_METRICS_ENABLED: false,
      AUTH_PROVIDER: "oidc",
      OIDC_ISSUER: "http://localhost:8095",
      OIDC_AUDIENCE: "lafken-api",
      OIDC_PRINCIPAL_CLAIM: "preferred_username",
      OIDC_ROLES_CLAIM: "roles",
      CLOUD_ENDPOINT_DEFINITION: false,
      IMGPROXY_BASE_URL: undefined,
      IMGPROXY_KEY: undefined,
      IMGPROXY_SALT: undefined,
      IMGPROXY_SIGNATURE_SIZE: 32,
      PROCESSING_WORKER_POLL_INTERVAL_MS: 1000,
      PROCESSING_WORKER_CONCURRENCY: 1,
      PROCESSING_WORKER_HEARTBEAT_INTERVAL_MS: 10_000,
      PROCESSING_WORKER_STALE_CLAIM_MS: 60_000,
      PROCESSING_WORKER_MAX_ATTEMPTS: 5,
      PROCESSING_WORKER_INITIAL_BACKOFF_MS: 1000,
      PROCESSING_WORKER_BACKOFF_MULTIPLIER: 3,
      PROCESSING_WORKER_MAX_BACKOFF_MS: 600_000,
      PROCESSING_WORKER_WORKFLOW_TIMEOUT_MS: 900_000,
      PROCESSING_WORKER_SHUTDOWN_GRACE_MS: 30_000,
      PROCESSING_VIRUS_SCAN_ADAPTER: "local",
      PROCESSING_VIRUS_SCAN_FORCE_INFECTED: false,
      PROCESSING_VIRUS_SCAN_SIGNATURE: undefined,
      CLAMAV_HOST: "clamav",
      CLAMAV_PORT: 3310,
      CLAMAV_TIMEOUT_MS: 30_000,
      CLAMAV_CHUNK_SIZE_BYTES: 65_536,
      PROCESSING_CONTENT_MODERATION_FORCE_DECISION: undefined,
      TUSD_ENDPOINT_URL: undefined,
      TUSD_INTERNAL_URL: undefined,
      ORPHAN_INTENT_SWEEP_INTERVAL_MS: 60_000,
      ORPHAN_INTENT_GRACE_MS: 300_000,
    },
  }),
);
