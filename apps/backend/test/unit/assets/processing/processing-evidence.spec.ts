import { describe, expect, it } from "vitest";

import {
  calculateDurationMs,
  isTerminalAssetState,
  makeStepTiming,
  makeTransitionMetadata,
} from "@/assets/application/processing/processing-evidence";

describe("processing evidence helpers", () => {
  it("calculates non-negative step duration", () => {
    const startedAt = new Date("2026-05-06T12:00:00.000Z");
    const finishedAt = new Date("2026-05-06T12:00:00.842Z");

    expect(calculateDurationMs(startedAt, finishedAt)).toBe(842);
  });

  it("clamps negative duration to zero when clocks move backwards", () => {
    const startedAt = new Date("2026-05-06T12:00:01.000Z");
    const finishedAt = new Date("2026-05-06T12:00:00.000Z");

    expect(calculateDurationMs(startedAt, finishedAt)).toBe(0);
  });

  it("builds transition metadata with worker, attempt, step, and duration", () => {
    const metadata = makeTransitionMetadata({
      workerId: "worker-a",
      attemptNumber: 2,
      step: "image_inspection",
      reasonCode: "invalid_image_format",
      durationMs: 34,
    });

    expect(metadata).toEqual({
      worker_id: "worker-a",
      job_attempt: 2,
      step: "image_inspection",
      reason_code: "invalid_image_format",
      duration_ms: 34,
    });
  });

  it("classifies terminal asset states", () => {
    expect(isTerminalAssetState("ready")).toBe(true);
    expect(isTerminalAssetState("rejected")).toBe(true);
    expect(isTerminalAssetState("quarantined_virus")).toBe(true);
    expect(isTerminalAssetState("quarantined_moderation")).toBe(true);
    expect(isTerminalAssetState("processing_failed")).toBe(true);
    expect(isTerminalAssetState("uploaded")).toBe(false);
    expect(isTerminalAssetState("processing")).toBe(false);
  });

  it("creates serializable step timing", () => {
    const timing = makeStepTiming({
      step: "virus_scan",
      startedAt: new Date("2026-05-06T12:00:00.000Z"),
      finishedAt: new Date("2026-05-06T12:00:00.210Z"),
      decision: "pass",
    });

    expect(timing).toEqual({
      step: "virus_scan",
      started_at: "2026-05-06T12:00:00.000Z",
      finished_at: "2026-05-06T12:00:00.210Z",
      duration_ms: 210,
      decision: "pass",
    });
  });
});
