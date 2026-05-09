import { describe, expect, it } from "vitest";

import { ProcessingRetryPolicy } from "@/assets/application/processing/processing-retry-policy";

describe("ProcessingRetryPolicy (single-tier exponential backoff)", () => {
  const baseOptions = {
    maxAttempts: 5,
    initialBackoffMs: 1000,
    backoffMultiplier: 3,
    maxBackoffMs: 600_000,
    jitter: () => 1, // upper bound of the half-jitter window
  } as const;

  it("releases attempt 1 with the initial delay", () => {
    const policy = new ProcessingRetryPolicy(baseOptions);

    expect(policy.nextRetry({ attemptNumber: 1 })).toEqual({
      kind: "release",
      delayMs: 1000,
      nextAttemptNumber: 2,
    });
  });

  it("multiplies the delay by the configured factor per attempt", () => {
    const policy = new ProcessingRetryPolicy(baseOptions);

    expect(policy.nextRetry({ attemptNumber: 2 })).toEqual({
      kind: "release",
      delayMs: 3000,
      nextAttemptNumber: 3,
    });
    expect(policy.nextRetry({ attemptNumber: 3 })).toEqual({
      kind: "release",
      delayMs: 9000,
      nextAttemptNumber: 4,
    });
  });

  it("caps the delay at the configured maximum", () => {
    const policy = new ProcessingRetryPolicy({ ...baseOptions, maxBackoffMs: 4000 });

    expect(policy.nextRetry({ attemptNumber: 3 })).toEqual({
      kind: "release",
      delayMs: 4000,
      nextAttemptNumber: 4,
    });
  });

  it("applies half-jitter in the range [0.5, 1.0] of the base delay", () => {
    const policy = new ProcessingRetryPolicy({ ...baseOptions, jitter: () => 0 });

    expect(policy.nextRetry({ attemptNumber: 1 })).toEqual({
      kind: "release",
      delayMs: 500,
      nextAttemptNumber: 2,
    });
  });

  it("returns exhausted when the next attempt would exceed maxAttempts", () => {
    const policy = new ProcessingRetryPolicy({ ...baseOptions, maxAttempts: 3 });

    expect(policy.nextRetry({ attemptNumber: 3 })).toEqual({ kind: "exhausted" });
  });
});
