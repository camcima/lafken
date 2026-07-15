import { describe, expect, it } from "vitest";

import { TusNotConfiguredError } from "@/assets/domain/errors/tus-not-configured.error";
import { CompositeUploadUrlIssuer } from "@/assets/infrastructure/services/composite-upload-url-issuer";

describe("CompositeUploadUrlIssuer", () => {
  const gcs = {
    issue: () =>
      Promise.resolve({
        protocol: "simple" as const,
        uploadUrl: "u",
        uploadHeaders: {},
        expiresAt: new Date(),
      }),
  };

  it("delegates simple issuance to the gcs issuer", async () => {
    const issuer = new CompositeUploadUrlIssuer({ gcs });

    const result = await issuer.issue({
      protocol: "simple",
      binding: { bucket: "b", projectId: "p" },
      storageKey: "k",
      contentType: "image/jpeg",
      maxBytes: BigInt(1),
      ttlSeconds: 60,
    });

    expect(result.uploadUrl).toBe("u");
  });

  it("always throws TusNotConfiguredError for protocol 'tus' (descoped from v1.0)", async () => {
    const issuer = new CompositeUploadUrlIssuer({ gcs });

    await expect(
      issuer.issue({
        protocol: "tus",
        binding: { bucket: "b", projectId: "p" },
        storageKey: "k",
        contentType: "image/jpeg",
        maxBytes: BigInt(1),
        ttlSeconds: 60,
      }),
    ).rejects.toBeInstanceOf(TusNotConfiguredError);
  });
});
