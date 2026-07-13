import { describe, expect, it } from "vitest";

import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";

describe("upload-features environment configuration", () => {
  it("provides orphan-sweep defaults", () => {
    expect(environmentConfiguration.ORPHAN_INTENT_SWEEP_INTERVAL_MS).toBe(60_000);
    expect(environmentConfiguration.ORPHAN_INTENT_GRACE_MS).toBe(300_000);
  });
});
