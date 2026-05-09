import { describe, expect, it } from "vitest";

import { TusNotConfiguredError } from "@/assets/domain/errors/tus-not-configured.error";
import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

describe("TusNotConfiguredError", () => {
  it("is a DomainError with a clear message", () => {
    const err = new TusNotConfiguredError();
    expect(err).toBeInstanceOf(DomainError);
    expect(err.message).toContain("tus");
    expect(err.message).toContain("TUSD_ENDPOINT_URL");
  });
});
