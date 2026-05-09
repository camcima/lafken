import { describe, expect, it } from "vitest";

import { UploadIntentAlreadyConsumedError } from "@/assets/domain/errors/upload-intent-already-consumed.error";
import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

describe("UploadIntentAlreadyConsumedError", () => {
  it("captures publicId and consumedAt", () => {
    const consumedAt = new Date("2026-05-09T10:00:00.000Z");
    const err = new UploadIntentAlreadyConsumedError({ publicId: "pid-1", consumedAt });
    expect(err).toBeInstanceOf(DomainError);
    expect(err.message).toContain("pid-1");
    expect(err.message).toContain(consumedAt.toISOString());
  });
});
