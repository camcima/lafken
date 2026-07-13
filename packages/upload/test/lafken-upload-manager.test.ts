import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LafkenUploadManager } from "../src/lafken-upload-manager";
import type {
  IFileConfirmedEventDetail,
  IFileFailedEventDetail,
  IFileQuarantinedEventDetail,
  IFileReadyEventDetail,
} from "../src/lafken-upload-manager";

/** Flush all pending microtasks (promises resolved in the current tick). */
async function flushMicrotasks(): Promise<void> {
  // Multiple awaits to drain chained promise chains.
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

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

    expect(client.assets.confirmUpload).toHaveBeenCalledWith("pub-123", {
      width: 256,
      height: 128,
    });
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

    expect(client.assets.confirmUpload).toHaveBeenCalledWith("pub-789", {
      width: 256,
      height: 128,
    });
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

  it("dispatches file-quarantined (not file-failed) when confirmUpload returns a quarantined state", async () => {
    // confirmUpload resolves successfully but with a quarantine state — the
    // server accepted the bytes but flagged them. The new behavior emits
    // file-quarantined with the quarantine kind, not file-failed.
    const client = {
      assets: {
        createUploadIntent: vi.fn(),
        confirmUpload: vi.fn().mockResolvedValue({
          publicId: "pub-quar",
          namespaceSlug: "ns",
          state: "quarantined_virus",
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
    const quarantinedEvents: IFileQuarantinedEventDetail[] = [];
    const confirmedEvents: IFileConfirmedEventDetail[] = [];
    manager.addEventListener("file-failed", (evt) => {
      failedEvents.push((evt as CustomEvent<IFileFailedEventDetail>).detail);
    });
    manager.addEventListener("file-quarantined", (evt) => {
      quarantinedEvents.push((evt as CustomEvent<IFileQuarantinedEventDetail>).detail);
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
    expect(failedEvents).toHaveLength(0);
    expect(confirmedEvents).toHaveLength(0);
    expect(quarantinedEvents).toHaveLength(1);
    expect(quarantinedEvents[0]).toMatchObject({
      fileId: uppyFile.id,
      publicId: "pub-quar",
      kind: "virus",
    });
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

    expect(client.assets.confirmUpload).toHaveBeenCalledWith("pub-456", {
      width: 256,
      height: 128,
    });
    expect(failedEvents).toHaveLength(1);
    expect(failedEvents[0].fileId).toBe(uppyFile.id);
    expect(failedEvents[0].error).toBe(confirmError);
  });

  describe("polling after confirmUpload returns state=processing", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("polls until ready and dispatches file-processing then file-ready", async () => {
      // confirmUpload returns state=processing, then get() returns processing twice,
      // then returns ready on the third poll.
      const client = {
        assets: {
          createUploadIntent: vi.fn(),
          confirmUpload: vi.fn().mockResolvedValue({
            publicId: "pub-poll",
            state: "processing",
          }),
          get: vi
            .fn()
            .mockResolvedValueOnce({ publicId: "pub-poll", state: "processing" })
            .mockResolvedValueOnce({ publicId: "pub-poll", state: "processing" })
            .mockResolvedValueOnce({ publicId: "pub-poll", state: "ready" }),
        },
      };

      const manager = new LafkenUploadManager({
        client: client as never,
        namespaceSlug: "ns",
        pollingIntervalMs: 1_000,
        pollingMaxIntervalMs: 10_000,
        pollingTimeoutMs: 600_000,
      });

      const processingEvents: unknown[] = [];
      const readyEvents: IFileReadyEventDetail[] = [];
      const failedEvents: IFileFailedEventDetail[] = [];

      manager.addEventListener("file-processing", (evt) => {
        processingEvents.push((evt as CustomEvent).detail);
      });
      manager.addEventListener("file-ready", (evt) => {
        readyEvents.push((evt as CustomEvent<IFileReadyEventDetail>).detail);
      });
      manager.addEventListener("file-failed", (evt) => {
        failedEvents.push((evt as CustomEvent<IFileFailedEventDetail>).detail);
      });

      const file = new File(["data"], "video.mp4", { type: "video/mp4" });
      manager.addFiles([file]);
      const uppy = manager.getUppy();
      const [uppyFile] = uppy.getFiles();
      expect(uppyFile).toBeDefined();

      /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
      (manager as any).publicIdByFileId.set(uppyFile.id, "pub-poll");
      /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */

      uppy.emit("complete", { successful: [uppyFile], failed: [] });

      // Let the confirm resolve and fire-processing emit.
      await flushMicrotasks();

      expect(processingEvents).toHaveLength(1);

      // Advance clock by 1s → first poll (returns processing); backoff → 2s next.
      await vi.advanceTimersByTimeAsync(1_000);
      await flushMicrotasks();
      expect(client.assets.get).toHaveBeenCalledTimes(1);
      expect(readyEvents).toHaveLength(0);

      // Advance clock by 2s → second poll (returns processing); backoff → 4s next.
      await vi.advanceTimersByTimeAsync(2_000);
      await flushMicrotasks();
      expect(client.assets.get).toHaveBeenCalledTimes(2);
      expect(readyEvents).toHaveLength(0);

      // Advance clock by 4s → third poll (returns ready).
      await vi.advanceTimersByTimeAsync(4_000);
      await flushMicrotasks();
      expect(client.assets.get).toHaveBeenCalledTimes(3);
      expect(readyEvents).toHaveLength(1);
      expect(readyEvents[0]).toMatchObject({
        fileId: uppyFile.id,
        publicId: "pub-poll",
        asset: { state: "ready" },
      });
      expect(failedEvents).toHaveLength(0);
    });

    it("dispatches file-failed with polling-timeout when polling exceeds pollingTimeoutMs", async () => {
      // get() always returns processing, never resolves.
      const client = {
        assets: {
          createUploadIntent: vi.fn(),
          confirmUpload: vi.fn().mockResolvedValue({
            publicId: "pub-timeout",
            state: "processing",
          }),
          get: vi.fn().mockResolvedValue({ publicId: "pub-timeout", state: "processing" }),
        },
      };

      const manager = new LafkenUploadManager({
        client: client as never,
        namespaceSlug: "ns",
        pollingIntervalMs: 1_000,
        pollingMaxIntervalMs: 2_000,
        pollingTimeoutMs: 5_000,
      });

      const failedEvents: IFileFailedEventDetail[] = [];
      const readyEvents: unknown[] = [];

      manager.addEventListener("file-failed", (evt) => {
        failedEvents.push((evt as CustomEvent<IFileFailedEventDetail>).detail);
      });
      manager.addEventListener("file-ready", (evt) => {
        readyEvents.push((evt as CustomEvent).detail);
      });

      const file = new File(["data"], "slow.mp4", { type: "video/mp4" });
      manager.addFiles([file]);
      const uppy = manager.getUppy();
      const [uppyFile] = uppy.getFiles();
      expect(uppyFile).toBeDefined();

      /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
      (manager as any).publicIdByFileId.set(uppyFile.id, "pub-timeout");
      /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */

      uppy.emit("complete", { successful: [uppyFile], failed: [] });

      // Let the confirm resolve.
      await flushMicrotasks();

      // Advance past timeout by advancing 1s intervals.
      // Interval 1: 1s, then 2s (capped), 2s, 2s... exceeds 5s total.
      // After 1s: first poll → elapsed ~1s, check timeout → not yet.
      await vi.advanceTimersByTimeAsync(1_000);
      await flushMicrotasks();

      // After 2s more (total 3s): second poll → elapsed ~3s, check timeout → not yet.
      await vi.advanceTimersByTimeAsync(2_000);
      await flushMicrotasks();

      // After 2s more (total 5s): third poll → elapsed ~5s ≥ 5000ms → emit timeout.
      await vi.advanceTimersByTimeAsync(2_000);
      await flushMicrotasks();

      expect(failedEvents).toHaveLength(1);
      expect(failedEvents[0].error.message).toBe("polling-timeout");
      expect(readyEvents).toHaveLength(0);
    });

    it("virus-positive confirm skips polling and dispatches file-quarantined immediately", async () => {
      // confirmUpload returns quarantined_virus directly — no polling needed.
      const client = {
        assets: {
          createUploadIntent: vi.fn(),
          confirmUpload: vi.fn().mockResolvedValue({
            publicId: "pub-virus",
            state: "quarantined_virus",
          }),
          get: vi.fn(),
        },
      };

      const manager = new LafkenUploadManager({
        client: client as never,
        namespaceSlug: "ns",
        pollingIntervalMs: 1_000,
        pollingMaxIntervalMs: 10_000,
        pollingTimeoutMs: 600_000,
      });

      const quarantinedEvents: IFileQuarantinedEventDetail[] = [];
      const processingEvents: unknown[] = [];
      const failedEvents: unknown[] = [];

      manager.addEventListener("file-quarantined", (evt) => {
        quarantinedEvents.push((evt as CustomEvent<IFileQuarantinedEventDetail>).detail);
      });
      manager.addEventListener("file-processing", (evt) => {
        processingEvents.push((evt as CustomEvent).detail);
      });
      manager.addEventListener("file-failed", (evt) => {
        failedEvents.push((evt as CustomEvent).detail);
      });

      const file = new File(["data"], "virus.jpg", { type: "image/jpeg" });
      manager.addFiles([file]);
      const uppy = manager.getUppy();
      const [uppyFile] = uppy.getFiles();
      expect(uppyFile).toBeDefined();

      /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
      (manager as any).publicIdByFileId.set(uppyFile.id, "pub-virus");
      /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */

      uppy.emit("complete", { successful: [uppyFile], failed: [] });

      // Let the confirm resolve.
      await flushMicrotasks();

      // No polling timers should have been scheduled — advance time to prove it.
      await vi.advanceTimersByTimeAsync(10_000);
      await flushMicrotasks();

      expect(client.assets.get).not.toHaveBeenCalled();
      expect(processingEvents).toHaveLength(0);
      expect(failedEvents).toHaveLength(0);
      expect(quarantinedEvents).toHaveLength(1);
      expect(quarantinedEvents[0]).toMatchObject({
        fileId: uppyFile.id,
        publicId: "pub-virus",
        kind: "virus",
      });
    });
  });

  it("dispatches file-failed when Uppy reports upload-error for a file", async () => {
    const client = makeClientMock();
    const manager = new LafkenUploadManager({
      client: client as never,
      namespaceSlug: "my-namespace",
    });

    const failures: IFileFailedEventDetail[] = [];
    manager.addEventListener("file-failed", (evt) => {
      failures.push((evt as CustomEvent<IFileFailedEventDetail>).detail);
    });

    manager.addFiles([new File(["x"], "x.png", { type: "image/png" })]);
    const uppy = manager.getUppy();
    const [uppyFile] = uppy.getFiles();
    expect(uppyFile).toBeDefined();

    uppy.emit("upload-error", uppyFile, { name: "HTTPError", message: "403 Forbidden" });
    await flushMicrotasks();

    expect(failures).toHaveLength(1);
    expect(failures[0].fileId).toBe(uppyFile.id);
    expect(failures[0].error.message).toBe("403 Forbidden");
  });
});
