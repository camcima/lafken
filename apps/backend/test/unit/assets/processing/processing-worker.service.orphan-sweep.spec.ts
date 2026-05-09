import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildOrphanSweeperSpy, buildWorkerHarness } from "./helpers/worker-harness";

describe("ProcessingWorkerService.orphan sweep loop", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("invokes the orphan sweeper at the configured interval", async () => {
    const sweeper = buildOrphanSweeperSpy();
    const { worker } = buildWorkerHarness({ orphanSweeper: sweeper });
    worker.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sweeper.executeCalls.length).toBeGreaterThanOrEqual(1);
    worker.beginShutdown();
  });
});
