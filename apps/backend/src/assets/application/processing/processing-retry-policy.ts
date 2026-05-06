export type RetryDecision =
  | { kind: "in_memory"; delayMs: number }
  | { kind: "release"; delayMs: number; nextAttemptNumber: number }
  | { kind: "exhausted" };

export interface IRetryInput {
  attemptNumber: number;
  failureCountInAttempt: number;
}

export interface IProcessingRetryPolicyOptions {
  maxAttempts: number;
  jitter?: () => number;
}

const FIRST_IN_MEMORY_DELAY_MS = 1000;
const SECOND_IN_MEMORY_DELAY_MS = 5000;
const THIRD_IN_MEMORY_DELAY_MS = 15_000;
const FIRST_RELEASE_DELAY_MS = 60_000;
const SECOND_RELEASE_DELAY_MS = 300_000;
const FIRST_RELEASE_ATTEMPT_NUMBER = 2;
const HALF_JITTER_FLOOR = 0.5;
const FULL_JITTER_SCALE = 0.5;

const IN_MEMORY_DELAYS_MS = [
  FIRST_IN_MEMORY_DELAY_MS,
  SECOND_IN_MEMORY_DELAY_MS,
  THIRD_IN_MEMORY_DELAY_MS,
] as const;
const RELEASE_DELAYS_MS = [FIRST_RELEASE_DELAY_MS, SECOND_RELEASE_DELAY_MS] as const;

export class ProcessingRetryPolicy {
  constructor(private readonly options: IProcessingRetryPolicyOptions) {}

  nextRetry(input: IRetryInput): RetryDecision {
    const inMemoryDelay: number | undefined = IN_MEMORY_DELAYS_MS[input.failureCountInAttempt];
    if (inMemoryDelay !== undefined) {
      return { kind: "in_memory", delayMs: this.withJitter(inMemoryDelay) };
    }

    const nextAttemptNumber: number = input.attemptNumber + 1;
    if (nextAttemptNumber > this.options.maxAttempts) {
      return { kind: "exhausted" };
    }

    const releaseIndex: number = Math.max(0, nextAttemptNumber - FIRST_RELEASE_ATTEMPT_NUMBER);
    const releaseDelay: number =
      RELEASE_DELAYS_MS[releaseIndex] ?? RELEASE_DELAYS_MS[RELEASE_DELAYS_MS.length - 1];
    return {
      kind: "release",
      delayMs: this.withJitter(releaseDelay),
      nextAttemptNumber,
    };
  }

  private withJitter(baseDelayMs: number): number {
    const jitter: () => number = this.options.jitter ?? Math.random;
    return Math.round(baseDelayMs * HALF_JITTER_FLOOR + jitter() * baseDelayMs * FULL_JITTER_SCALE);
  }
}
