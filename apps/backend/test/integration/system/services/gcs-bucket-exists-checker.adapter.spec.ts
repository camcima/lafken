import { describe, expect, it } from "vitest";

import { BucketCheckFailedError } from "@/system/domain/errors/bucket-check-failed.error";
import { BucketNotFoundError } from "@/system/domain/errors/bucket-not-found.error";
import { GcsBucketExistsCheckerAdapter } from "@/system/infrastructure/services/gcs-bucket-exists-checker.adapter";

const ENDPOINT = "http://localhost:4444";

describe("GcsBucketExistsCheckerAdapter (fake-gcs-server)", () => {
  it("resolves when the bucket exists", async () => {
    const checker = new GcsBucketExistsCheckerAdapter({ endpoint: ENDPOINT });
    await expect(
      checker.checkBucketExists({
        adapterType: "gcs",
        config: { bucket: "lafken-dev", projectId: "lafken-dev" },
      }),
    ).resolves.toBeUndefined();
  });

  it("throws BucketNotFoundError when the bucket is missing", async () => {
    const checker = new GcsBucketExistsCheckerAdapter({ endpoint: ENDPOINT });
    await expect(
      checker.checkBucketExists({
        adapterType: "gcs",
        config: { bucket: "definitely-not-here", projectId: "lafken-dev" },
      }),
    ).rejects.toBeInstanceOf(BucketNotFoundError);
  });

  it("throws BucketCheckFailedError when the endpoint is unreachable", async () => {
    const checker = new GcsBucketExistsCheckerAdapter({
      endpoint: "http://127.0.0.1:1",
    });
    await expect(
      checker.checkBucketExists({
        adapterType: "gcs",
        config: { bucket: "anything", projectId: "anything" },
      }),
    ).rejects.toBeInstanceOf(BucketCheckFailedError);
  });
});
