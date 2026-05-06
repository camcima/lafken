import { describe, expect, it } from "vitest";

import { LocalContentModerationAdapter } from "@/assets/infrastructure/services/local-content-moderation.adapter";

describe("LocalContentModerationAdapter", () => {
  it("returns pass by default", async () => {
    const adapter = new LocalContentModerationAdapter();

    const result = await adapter.analyze({
      bytes: Buffer.from("safe"),
      policyConfig: { threshold: 0.9 },
    });

    expect(result.decision).toBe("pass");
    expect(result.findings["adapter"]).toBe("local-content-moderation");
  });

  it("returns quarantine when policy fixture asks for it", async () => {
    const adapter = new LocalContentModerationAdapter();

    const result = await adapter.analyze({
      bytes: Buffer.from("flagged"),
      policyConfig: {
        localDecision: "quarantine",
        category: "violence",
        score: 0.99,
        threshold: 0.8,
      },
    });

    expect(result.decision).toBe("quarantine");
    expect(result.reason).toBe("moderation_quarantined");
    expect(result.findings["category"]).toBe("violence");
  });
});
