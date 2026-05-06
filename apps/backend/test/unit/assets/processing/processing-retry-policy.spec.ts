import { describe, expect, it } from "vitest";

import { ProcessingRetryPolicy } from "@/assets/application/processing/processing-retry-policy";

describe("ProcessingRetryPolicy", () => {
  it("returns in-memory retry delays for first transient failures", () => {
    const policy = new ProcessingRetryPolicy({ maxAttempts: 5, jitter: () => 1 });

    expect(policy.nextRetry({ attemptNumber: 1, failureCountInAttempt: 0 })).toEqual({
      kind: "in_memory",
      delayMs: 1000,
    });
    expect(policy.nextRetry({ attemptNumber: 1, failureCountInAttempt: 1 })).toEqual({
      kind: "in_memory",
      delayMs: 5000,
    });
  });

  it("releases with backoff after in-memory retries are exhausted", () => {
    const policy = new ProcessingRetryPolicy({ maxAttempts: 5, jitter: () => 1 });

    expect(policy.nextRetry({ attemptNumber: 1, failureCountInAttempt: 3 })).toEqual({
      kind: "release",
      delayMs: 60_000,
      nextAttemptNumber: 2,
    });
  });

  it("returns exhausted when max attempts would be exceeded", () => {
    const policy = new ProcessingRetryPolicy({ maxAttempts: 2, jitter: () => 1 });

    expect(policy.nextRetry({ attemptNumber: 2, failureCountInAttempt: 3 })).toEqual({
      kind: "exhausted",
    });
  });
});
