import { describe, expect, it } from "vitest";

import { ProcessingJob } from "@/assets/domain/entities/processing-job.entity";
import { ProcessingJobResponseMapper } from "@/assets/presentation/mappers/processing-job.response-mapper";

describe("ProcessingJobResponseMapper", () => {
  it("maps failed processing jobs", () => {
    const now = new Date("2026-05-06T12:00:00.000Z");
    const dto = ProcessingJobResponseMapper.fromDomain(
      ProcessingJob.fromProps({
        assetId: "asset-1",
        state: "failed",
        workerId: null,
        currentStep: "image_inspection",
        attemptNumber: 5,
        notBefore: null,
        claimedAt: null,
        heartbeatAt: null,
        lastError: "retry budget exhausted",
        lastErrorAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    );

    expect(dto.state).toBe("failed");
    expect(dto.lastError).toBe("retry budget exhausted");
  });
});
