import { describe, expect, it } from "vitest";

import { TusdUploadUrlIssuer } from "@/assets/infrastructure/services/tusd-upload-url-issuer.adapter";

const NOW = new Date("2026-05-09T12:00:00.000Z");

describe("TusdUploadUrlIssuer", () => {
  it("returns a tus resource URL with required headers", async () => {
    const issuer = new TusdUploadUrlIssuer({
      endpointUrl: "http://localhost:1080/files/",
      now: () => NOW,
    });
    const result = await issuer.issue({
      protocol: "tus",
      binding: { bucket: "lafken-dev", projectId: "fake-project-1" },
      storageKey: "ns/assets/pid-1/source",
      contentType: "image/jpeg",
      maxBytes: BigInt(2_000),
      ttlSeconds: 900,
    });
    expect(result.protocol).toBe("tus");
    expect(result.uploadUrl).toMatch(/^http:\/\/localhost:1080\/files\//);
    expect(result.uploadHeaders["Tus-Resumable"]).toBe("1.0.0");
    expect(result.uploadHeaders["Upload-Length"]).toBe("2000");
    // Upload-Metadata is comma-separated `key b64(value)` pairs per tus spec.
    expect(result.uploadHeaders["Upload-Metadata"]).toContain("storageKey");
    expect(result.uploadHeaders["Upload-Metadata"]).toContain("contentType");
    expect(result.expiresAt.getTime()).toBe(NOW.getTime() + 900_000);
  });

  it("normalizes endpoint without trailing slash", async () => {
    const issuer = new TusdUploadUrlIssuer({
      endpointUrl: "http://tusd:1080/files",
      now: () => NOW,
    });
    const result = await issuer.issue({
      protocol: "tus",
      binding: { bucket: "b", projectId: "p" },
      storageKey: "k",
      contentType: "image/png",
      maxBytes: BigInt(1),
      ttlSeconds: 60,
    });
    expect(result.uploadUrl.startsWith("http://tusd:1080/files/")).toBe(true);
  });
});
