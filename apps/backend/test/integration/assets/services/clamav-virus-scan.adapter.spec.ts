import { describe, expect, it } from "vitest";

import { ClamAvVirusScanAdapter } from "@/assets/infrastructure/services/clamav-virus-scan.adapter";

// docker-compose.test.yml exposes the clamd container on host port 3311.
const HOST = "localhost";
const PORT = 3311;
// Generous default — first-time clients on a cold signature DB occasionally
// take longer to respond while clamd is still warming caches.
const TIMEOUT_MS = 30_000;
const CHUNK_SIZE_BYTES = 64 * 1024;

// eslint-disable-next-line no-process-env
const GATE = process.env["LAFKEN_E2E_REQUIRES_CLAMAV"] === "true";

// EICAR Anti-Virus Test File. Standard, harmless string that every AV product
// is required to flag — used to verify the path end-to-end without ever
// touching real malware.
const EICAR: Buffer = Buffer.from(
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
);

function makeAdapter(): ClamAvVirusScanAdapter {
  return new ClamAvVirusScanAdapter({
    host: HOST,
    port: PORT,
    timeoutMs: TIMEOUT_MS,
    chunkSizeBytes: CHUNK_SIZE_BYTES,
  });
}

describe.skipIf(!GATE)("ClamAvVirusScanAdapter (real clamd)", () => {
  it("returns pass for benign bytes", async () => {
    const adapter = makeAdapter();
    const result = await adapter.scan({
      bytes: Buffer.from("hello, this is a benign payload"),
      contentHash: null,
    });

    expect(result.decision).toBe("pass");
    expect(result.reason).toBeNull();
    expect(result.findings["adapter"]).toBe("clamav");
    expect(result.findings["raw_response"]).toBe("stream: OK");
  });

  it("quarantines the EICAR test signature and surfaces the signature name", async () => {
    const adapter = makeAdapter();
    const result = await adapter.scan({ bytes: EICAR, contentHash: null });

    expect(result.decision).toBe("quarantine");
    expect(result.reason).toMatch(/^virus_detected:/);
    expect(typeof result.findings["signature"]).toBe("string");
    // ClamAV's standard label for EICAR is `Win.Test.EICAR_HDB-1` (or close
    // variants depending on signature DB version). We assert on EICAR-prefix
    // matching to stay resilient to label drift.
    expect(String(result.findings["signature"])).toMatch(/EICAR/i);
  });

  it("rejects with a connection error when clamd is unreachable", async () => {
    const adapter = new ClamAvVirusScanAdapter({
      host: HOST,
      port: 1, // Reserved/closed; connect() should fail immediately.
      timeoutMs: 2_000,
      chunkSizeBytes: CHUNK_SIZE_BYTES,
    });
    await expect(adapter.scan({ bytes: EICAR, contentHash: null })).rejects.toThrow();
  });
});
