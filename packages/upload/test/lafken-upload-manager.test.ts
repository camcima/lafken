import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LafkenUploadManager } from "../src/lafken-upload-manager";
import type {
  IFileConfirmedEventDetail,
  IFileFailedEventDetail,
} from "../src/lafken-upload-manager";

class FakeImage {
  public naturalWidth = 256;
  public naturalHeight = 128;
  public onload: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public set src(_value: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}

beforeEach(() => {
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal("URL", {
    createObjectURL: (): string => "blob:fake",
    revokeObjectURL: (): void => {
      // no-op
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeClientMock(overrides?: {
  createUploadIntentError?: Error;
  confirmUploadError?: Error;
}) {
  return {
    assets: {
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
    },
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

    expect(client.assets.confirmUpload).toHaveBeenCalledWith("pub-123", { width: 256, height: 128 });
    expect(confirmedEvents).toHaveLength(1);
    expect(confirmedEvents[0]).toEqual({ fileId: uppyFile.id, publicId: "pub-123" });
  });

  it("forwards probed image dimensions to confirmUpload", async () => {
    const client = makeClientMock();
    const manager = new LafkenUploadManager({
      client: client as never,
      namespaceSlug: "my-namespace",
    });

    const file = new File(["data"], "image.png", { type: "image/png" });
    manager.addFiles([file]);
    const uppy = manager.getUppy();
    const [uppyFile] = uppy.getFiles();
    expect(uppyFile).toBeDefined();

    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (manager as any).publicIdByFileId.set(uppyFile.id, "pub-789");
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

    uppy.emit("complete", { successful: [uppyFile], failed: [] });

    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(client.assets.confirmUpload).toHaveBeenCalledWith("pub-789", { width: 256, height: 128 });
  });

  it("calls confirmUpload without dimensions for non-image files", async () => {
    const client = makeClientMock();
    const manager = new LafkenUploadManager({
      client: client as never,
      namespaceSlug: "my-namespace",
    });

    const file = new File(["data"], "doc.pdf", { type: "application/pdf" });
    manager.addFiles([file]);
    const uppy = manager.getUppy();
    const [uppyFile] = uppy.getFiles();
    expect(uppyFile).toBeDefined();

    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (manager as any).publicIdByFileId.set(uppyFile.id, "pub-doc");
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

    uppy.emit("complete", { successful: [uppyFile], failed: [] });

    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(client.assets.confirmUpload).toHaveBeenCalledWith("pub-doc", undefined);
  });

  it("forwards shared metadata to confirmUpload alongside dimensions", async () => {
    const client = makeClientMock();
    const manager = new LafkenUploadManager({
      client: client as never,
      namespaceSlug: "my-namespace",
    });
    manager.setSharedMetadata({
      externalRefType: "work_order",
      externalRefId: "WO-1",
      tags: ["preflight"],
    });

    const file = new File(["data"], "shared.jpg", { type: "image/jpeg" });
    manager.addFiles([file]);
    const uppy = manager.getUppy();
    const [uppyFile] = uppy.getFiles();
    expect(uppyFile).toBeDefined();

    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (manager as any).publicIdByFileId.set(uppyFile.id, "pub-shared");
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

    uppy.emit("complete", { successful: [uppyFile], failed: [] });
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(client.assets.confirmUpload).toHaveBeenCalledWith("pub-shared", {
      externalRefType: "work_order",
      externalRefId: "WO-1",
      tags: ["preflight"],
      width: 256,
      height: 128,
    });
  });

  it("isolates pre-processor failures: bad file is dropped, others proceed", async () => {
    const intentError = new Error("MimeTypeNotAllowedError: application/pdf is not allowed");
    const client = {
      assets: {
        createUploadIntent: vi
          .fn()
          // First call (PNG) succeeds; second call (PDF) is rejected by namespace policy.
          .mockResolvedValueOnce({
            publicId: "pub-png",
            uploadUrl: "https://storage.example.com/upload/png",
            uploadHeaders: {},
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          })
          .mockRejectedValueOnce(intentError),
        confirmUpload: vi.fn(),
      },
    };

    const manager = new LafkenUploadManager({
      client: client as never,
      namespaceSlug: "ns",
    });

    const failedEvents: IFileFailedEventDetail[] = [];
    manager.addEventListener("file-failed", (evt) => {
      failedEvents.push((evt as CustomEvent<IFileFailedEventDetail>).detail);
    });

    const png = new File(["a"], "ok.png", { type: "image/png" });
    const pdf = new File(["b"], "bad.pdf", { type: "application/pdf" });
    manager.addFiles([png, pdf]);

    const uppy = manager.getUppy();
    const [pngFile, pdfFile] = uppy.getFiles();
    expect(pngFile).toBeDefined();
    expect(pdfFile).toBeDefined();

    // Invoke the pre-processor directly so we can verify side effects without
    // running the full XHR upload phase.
    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
    await (manager as any).runPreProcessing([pngFile.id, pdfFile.id]);
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */

    // Bad file emitted file-failed and was removed from Uppy.
    expect(failedEvents).toHaveLength(1);
    expect(failedEvents[0]).toEqual({ fileId: pdfFile.id, error: intentError });
    expect(uppy.getFile(pdfFile.id)).toBeUndefined();

    // Good file is still in the queue with publicId mapped.
    expect(uppy.getFile(pngFile.id)).toBeDefined();
    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
    expect((manager as any).publicIdByFileId.get(pngFile.id)).toBe("pub-png");
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
  });

  it("dispatches file-failed when confirmUpload returns a quarantined state", async () => {
    // confirmUpload resolves successfully but with a quarantine state — the
    // server accepted the bytes but flagged them for review. From the user's
    // perspective this is a failure (the file isn't usable yet).
    const client = {
      assets: {
        createUploadIntent: vi.fn(),
        confirmUpload: vi.fn().mockResolvedValue({
          publicId: "pub-quar",
          namespaceSlug: "ns",
          state: "quarantined_invalid_format",
          storageKey: "key",
          declaredMimeType: "image/jpeg",
          sizeBytes: 1024,
          uploadedBy: null,
          confirmedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }),
      },
    };
    const manager = new LafkenUploadManager({
      client: client as never,
      namespaceSlug: "ns",
    });

    const failedEvents: IFileFailedEventDetail[] = [];
    const confirmedEvents: IFileConfirmedEventDetail[] = [];
    manager.addEventListener("file-failed", (evt) => {
      failedEvents.push((evt as CustomEvent<IFileFailedEventDetail>).detail);
    });
    manager.addEventListener("file-confirmed", (evt) => {
      confirmedEvents.push((evt as CustomEvent<IFileConfirmedEventDetail>).detail);
    });

    const file = new File(["data"], "fake.jpg", { type: "image/jpeg" });
    manager.addFiles([file]);
    const uppy = manager.getUppy();
    const [uppyFile] = uppy.getFiles();
    expect(uppyFile).toBeDefined();

    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
    (manager as any).publicIdByFileId.set(uppyFile.id, "pub-quar");
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */

    uppy.emit("complete", { successful: [uppyFile], failed: [] });
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(client.assets.confirmUpload).toHaveBeenCalledTimes(1);
    expect(failedEvents).toHaveLength(1);
    expect(failedEvents[0].error.message).toBe("quarantined: quarantined_invalid_format");
    expect(confirmedEvents).toHaveLength(0);
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

    expect(client.assets.confirmUpload).toHaveBeenCalledWith("pub-456", { width: 256, height: 128 });
    expect(failedEvents).toHaveLength(1);
    expect(failedEvents[0].fileId).toBe(uppyFile.id);
    expect(failedEvents[0].error).toBe(confirmError);
  });
});
