export type RetryDecision =
  | { kind: "release"; delayMs: number; nextAttemptNumber: number }
  | { kind: "exhausted" };

export interface IRetryInput {
  attemptNumber: number;
}

export interface IProcessingRetryPolicyOptions {
  maxAttempts: number;
  initialBackoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
  jitter?: () => number;
}

const HALF_JITTER_FLOOR = 0.5;
const HALF_JITTER_SCALE = 0.5;

export class ProcessingRetryPolicy {
  constructor(private readonly options: IProcessingRetryPolicyOptions) {}

  nextRetry(input: IRetryInput): RetryDecision {
    const nextAttemptNumber: number = input.attemptNumber + 1;
    if (nextAttemptNumber > this.options.maxAttempts) {
      return { kind: "exhausted" };
    }

    const exponent: number = input.attemptNumber - 1;
    const rawDelay: number =
      this.options.initialBackoffMs * Math.pow(this.options.backoffMultiplier, exponent);
    const cappedDelay: number = Math.min(rawDelay, this.options.maxBackoffMs);
    return {
      kind: "release",
      delayMs: this.withJitter(cappedDelay),
      nextAttemptNumber,
    };
  }

  private withJitter(baseDelayMs: number): number {
    const jitter: () => number = this.options.jitter ?? Math.random;
    return Math.round(baseDelayMs * HALF_JITTER_FLOOR + jitter() * baseDelayMs * HALF_JITTER_SCALE);
  }
}
