import { describe, expect, it } from "vitest";

import { GcsSignedUploadUrlIssuer } from "@/assets/infrastructure/services/gcs-signed-upload-url-issuer.adapter";

import { FakeAssetStorage } from "../../../__fakes__/fake-asset-storage";

describe("GcsSignedUploadUrlIssuer", () => {
  it("delegates to the storage adapter and labels the protocol", async () => {
    const storage = new FakeAssetStorage();
    const issuer = new GcsSignedUploadUrlIssuer(storage);
    const result = await issuer.issue({
      protocol: "simple",
      binding: { bucket: "b", projectId: "p" },
      storageKey: "ns/assets/pid/source",
      contentType: "image/jpeg",
      maxBytes: BigInt(1_000),
      ttlSeconds: 900,
    });
    expect(result.protocol).toBe("simple");
    expect(result.uploadUrl).toContain("https://fake-gcs.local/upload/");
    expect(result.uploadHeaders["Content-Type"]).toBe("image/jpeg");
    expect(storage.issued).toHaveLength(1);
  });
});
