import { describe, expect, it } from "vitest";

import { TusNotConfiguredError } from "@/assets/domain/errors/tus-not-configured.error";
import { CompositeUploadUrlIssuer } from "@/assets/infrastructure/services/composite-upload-url-issuer";

describe("CompositeUploadUrlIssuer", () => {
  it("delegates simple to gcs and tus to tusd", async () => {
    const calls: string[] = [];
    const issuer = new CompositeUploadUrlIssuer({
      gcs: {
        issue: async () => {
          calls.push("gcs");
          return {
            protocol: "simple",
            uploadUrl: "u",
            uploadHeaders: {},
            expiresAt: new Date(),
          };
        },
      },
      tusd: {
        issue: async () => {
          calls.push("tusd");
          return {
            protocol: "tus",
            uploadUrl: "t",
            uploadHeaders: {},
            expiresAt: new Date(),
          };
        },
      },
    });
    await issuer.issue({
      protocol: "simple",
      binding: { bucket: "b", projectId: "p" },
      storageKey: "k",
      contentType: "image/jpeg",
      maxBytes: BigInt(1),
      ttlSeconds: 60,
    });
    await issuer.issue({
      protocol: "tus",
      binding: { bucket: "b", projectId: "p" },
      storageKey: "k",
      contentType: "image/jpeg",
      maxBytes: BigInt(1),
      ttlSeconds: 60,
    });
    expect(calls).toEqual(["gcs", "tusd"]);
  });

  it("throws TusNotConfiguredError when tusd issuer is null", async () => {
    const issuer = new CompositeUploadUrlIssuer({
      gcs: {
        issue: async () => ({
          protocol: "simple",
          uploadUrl: "u",
          uploadHeaders: {},
          expiresAt: new Date(),
        }),
      },
      tusd: null,
    });
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
