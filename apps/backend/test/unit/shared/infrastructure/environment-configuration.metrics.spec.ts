import { describe, expect, it } from "vitest";

import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";

describe("metrics environment configuration", () => {
  it("exposes OTEL_METRICS_ENABLED with a boolean default", () => {
    expect(typeof environmentConfiguration.OTEL_METRICS_ENABLED).toBe("boolean");
  });
});
