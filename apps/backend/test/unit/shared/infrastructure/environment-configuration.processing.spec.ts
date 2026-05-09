import { describe, expect, it } from "vitest";

import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";

describe("processing worker environment configuration", () => {
  it("provides conservative worker defaults", () => {
    expect(environmentConfiguration.PROCESSING_WORKER_POLL_INTERVAL_MS).toBe(1000);
    expect(environmentConfiguration.PROCESSING_WORKER_CONCURRENCY).toBe(1);
    expect(environmentConfiguration.PROCESSING_WORKER_HEARTBEAT_INTERVAL_MS).toBe(10_000);
    expect(environmentConfiguration.PROCESSING_WORKER_STALE_CLAIM_MS).toBe(60_000);
    expect(environmentConfiguration.PROCESSING_WORKER_MAX_ATTEMPTS).toBe(5);
    expect(environmentConfiguration.PROCESSING_WORKER_SHUTDOWN_GRACE_MS).toBe(30_000);
  });

  it("provides single-tier backoff defaults", () => {
    expect(environmentConfiguration.PROCESSING_WORKER_INITIAL_BACKOFF_MS).toBe(1000);
    expect(environmentConfiguration.PROCESSING_WORKER_BACKOFF_MULTIPLIER).toBe(3);
    expect(environmentConfiguration.PROCESSING_WORKER_MAX_BACKOFF_MS).toBe(600_000);
  });

  it("provides a 15 minute whole-workflow timeout default", () => {
    expect(environmentConfiguration.PROCESSING_WORKER_WORKFLOW_TIMEOUT_MS).toBe(900_000);
  });
});
