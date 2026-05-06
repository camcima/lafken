import { describe, expect, it } from "vitest";

import { LocalVirusScanAdapter } from "@/assets/infrastructure/services/local-virus-scan.adapter";

describe("LocalVirusScanAdapter", () => {
  it("returns pass by default", async () => {
    const adapter = new LocalVirusScanAdapter();

    const result = await adapter.scan({
      bytes: Buffer.from("clean"),
      contentHash: Buffer.alloc(32, 1),
    });

    expect(result.decision).toBe("pass");
    expect(result.findings["adapter"]).toBe("local-virus-scan");
  });

  it("returns quarantine when configured with infected=true", async () => {
    const adapter = new LocalVirusScanAdapter({ infected: true, signature: "EICAR-Test" });

    const result = await adapter.scan({
      bytes: Buffer.from("infected"),
      contentHash: Buffer.alloc(32, 2),
    });

    expect(result.decision).toBe("quarantine");
    expect(result.reason).toBe("virus_detected");
    expect(result.findings["signature"]).toBe("EICAR-Test");
  });
});
