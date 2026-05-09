import { describe, expect, it } from "vitest";

import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";

describe("upload-features environment configuration", () => {
  it("leaves TUSD_ENDPOINT_URL and TUSD_INTERNAL_URL undefined when unset", () => {
    expect(environmentConfiguration.TUSD_ENDPOINT_URL).toBeUndefined();
    expect(environmentConfiguration.TUSD_INTERNAL_URL).toBeUndefined();
  });

  it("provides orphan-sweep defaults", () => {
    expect(environmentConfiguration.ORPHAN_INTENT_SWEEP_INTERVAL_MS).toBe(60_000);
    expect(environmentConfiguration.ORPHAN_INTENT_GRACE_MS).toBe(300_000);
  });
});
