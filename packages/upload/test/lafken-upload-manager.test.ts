import { describe, expect, it, vi } from "vitest";

import { LafkenUploadManager } from "../src/lafken-upload-manager";
import type {
  IFileConfirmedEventDetail,
  IFileFailedEventDetail,
} from "../src/lafken-upload-manager";

function makeClientMock(overrides?: {
  createUploadIntentError?: Error;
  confirmUploadError?: Error;
}) {
  return {
    createUploadIntent: overrides?.createUploadIntentError
      ? vi.fn().mockRejectedValue(overrides.createUploadIntentError)
      : vi.fn().mockResolvedValue({
          publicId: "pub-123",
          uploadUrl: "https://storage.example.com/upload/key",
          uploadHeaders: { "x-goog-content-length-range": "0,10485760" },
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        }),
    confirmUpload: overrides?.confirmUploadError
      ? vi.fn().mockRejectedValue(overrides.confirmUploadError)
      : vi.fn().mockResolvedValue({
          publicId: "pub-123",
          namespaceSlug: "ns",
          state: "confirmed",
          storageKey: "key",
          declaredMimeType: "image/png",
          sizeBytes: 1024,
          uploadedBy: null,
          confirmedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }),
  };
}

describe("LafkenUploadManager", () => {
  it("dispatches file-confirmed after a successful upload and confirm", async () => {
    const client = makeClientMock();
    const manager = new LafkenUploadManager({
      client: client as never,
      namespaceSlug: "my-namespace",
    });

    const confirmedEvents: IFileConfirmedEventDetail[] = [];
    manager.addEventListener("file-confirmed", (evt) => {
      confirmedEvents.push((evt as CustomEvent<IFileConfirmedEventDetail>).detail);
    });

    const file = new File(["hello"], "hello.png", { type: "image/png" });

    // We don't actually run Uppy's full XHR upload in unit tests;
    // instead we directly trigger the confirm path by simulating
    // a completed upload via the internal confirmCompletedFiles method.
    manager.addFiles([file]);
    const uppy = manager.getUppy();

    // Retrieve the Uppy file id
    const [uppyFile] = uppy.getFiles();
    expect(uppyFile).toBeDefined();

    // Simulate what the pre-processor would have done: map the uppy file id to a publicId
    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (manager as any).publicIdByFileId.set(uppyFile.id, "pub-123");
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

    // Simulate uppy 'complete' event with the file in successful list
    uppy.emit("complete", { successful: [uppyFile], failed: [] });

    // Wait for async confirmCompletedFiles to finish
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(client.confirmUpload).toHaveBeenCalledWith("pub-123");
    expect(confirmedEvents).toHaveLength(1);
    expect(confirmedEvents[0]).toEqual({ fileId: uppyFile.id, publicId: "pub-123" });
  });

  it("dispatches file-failed when confirmUpload throws", async () => {
    const confirmError = new Error("Confirm failed");
    const client = makeClientMock({ confirmUploadError: confirmError });
    const manager = new LafkenUploadManager({
      client: client as never,
      namespaceSlug: "my-namespace",
    });

    const failedEvents: IFileFailedEventDetail[] = [];
    manager.addEventListener("file-failed", (evt) => {
      failedEvents.push((evt as CustomEvent<IFileFailedEventDetail>).detail);
    });

    const file = new File(["data"], "image.jpg", { type: "image/jpeg" });
    manager.addFiles([file]);
    const uppy = manager.getUppy();
    const [uppyFile] = uppy.getFiles();
    expect(uppyFile).toBeDefined();

    // Inject publicId into the private map
    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (manager as any).publicIdByFileId.set(uppyFile.id, "pub-456");
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

    // Simulate complete event
    uppy.emit("complete", { successful: [uppyFile], failed: [] });

    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(client.confirmUpload).toHaveBeenCalledWith("pub-456");
    expect(failedEvents).toHaveLength(1);
    expect(failedEvents[0].fileId).toBe(uppyFile.id);
    expect(failedEvents[0].error).toBe(confirmError);
  });
});
