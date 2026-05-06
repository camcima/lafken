/**
 * Calculates the elapsed milliseconds between two timestamps, clamped to zero
 * when the system clock moves backwards (e.g. NTP correction). Used by
 * processing-step evidence and any other code that needs to record a duration
 * without leaking negative values into structured logs or DB columns.
 */
export function calculateDurationMs(startedAt: Date, finishedAt: Date): number {
  const durationMs: number = finishedAt.getTime() - startedAt.getTime();
  return Math.max(0, durationMs);
}
