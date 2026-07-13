import type { LafkenUploadManager } from "@lafken/upload";
import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useImageUpload } from "../src/index";

const stubClient = {
  createUploadIntent: vi.fn().mockResolvedValue({
    publicId: "00000000-0000-0000-0000-000000000001",
    uploadUrl: "https://fake-gcs.local/u",
    uploadHeaders: { "Content-Type": "image/jpeg" },
    expiresAt: new Date().toISOString(),
  }),
  confirmUpload: vi.fn().mockResolvedValue({ publicId: "x", state: "uploaded" }),
};

// Capture constructed manager instances for event dispatch in lifecycle tests.
const capturedManagers: EventTarget[] = [];
const managerCtorArgs: unknown[] = [];

vi.mock("@lafken/upload", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@lafken/upload")>();
  const OriginalManager = mod.LafkenUploadManager;
  class SpiedManager extends OriginalManager {
    public cancelAllCalls = 0;
    constructor(opts: ConstructorParameters<typeof OriginalManager>[0]) {
      managerCtorArgs.push(opts);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      super(opts as any);
      capturedManagers.push(this);
    }
    override cancelAll(): void {
      this.cancelAllCalls += 1;
      super.cancelAll();
    }
  }
  return { ...mod, LafkenUploadManager: SpiedManager };
});

class FakeImage {
  public naturalWidth = 32;
  public naturalHeight = 16;
  public onload: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public set src(_value: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}

describe("useImageUpload", () => {
  it("addFiles updates the files list with state=idle", () => {
    const { result } = renderHook(() =>
      useImageUpload({
        client: stubClient as unknown as Parameters<typeof useImageUpload>[0]["client"],
        namespaceSlug: "ns",
      }),
    );

    act(() => {
      result.current.addFiles([new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" })]);
    });

    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0].state).toBe("idle");
  });

  it("file-processing event advances file state to 'processing'", () => {
    const { result } = renderHook(() =>
      useImageUpload({
        client: stubClient as unknown as Parameters<typeof useImageUpload>[0]["client"],
        namespaceSlug: "ns",
      }),
    );

    act(() => {
      result.current.addFiles([new File([new Uint8Array([1])], "b.jpg", { type: "image/jpeg" })]);
    });

    const fileId = result.current.files[0].id;
    const manager = capturedManagers[capturedManagers.length - 1];

    act(() => {
      manager.dispatchEvent(
        new CustomEvent("file-processing", { detail: { fileId, publicId: "pub-b" } }),
      );
    });

    expect(result.current.files[0].state).toBe("processing");
  });

  it("file-ready event advances file state to 'ready' and sets terminalAsset", () => {
    const { result } = renderHook(() =>
      useImageUpload({
        client: stubClient as unknown as Parameters<typeof useImageUpload>[0]["client"],
        namespaceSlug: "ns",
      }),
    );

    act(() => {
      result.current.addFiles([new File([new Uint8Array([1])], "c.jpg", { type: "image/jpeg" })]);
    });

    const fileId = result.current.files[0].id;
    const manager = capturedManagers[capturedManagers.length - 1];
    const asset = { state: "ready", publicId: "pub-c" };

    act(() => {
      manager.dispatchEvent(
        new CustomEvent("file-ready", { detail: { fileId, publicId: "pub-c", asset } }),
      );
    });

    expect(result.current.files[0].state).toBe("ready");
    expect(result.current.files[0].terminalAsset).toEqual(asset);
  });

  it("file-quarantined event advances file state to 'quarantined' with error.kind='virus'", () => {
    const { result } = renderHook(() =>
      useImageUpload({
        client: stubClient as unknown as Parameters<typeof useImageUpload>[0]["client"],
        namespaceSlug: "ns",
      }),
    );

    act(() => {
      result.current.addFiles([new File([new Uint8Array([1])], "d.jpg", { type: "image/jpeg" })]);
    });

    const fileId = result.current.files[0].id;
    const manager = capturedManagers[capturedManagers.length - 1];

    act(() => {
      manager.dispatchEvent(
        new CustomEvent("file-quarantined", {
          detail: { fileId, publicId: "pub-d", kind: "virus" },
        }),
      );
    });

    expect(result.current.files[0].state).toBe("quarantined");
    expect(result.current.files[0].error).toMatchObject({ kind: "virus" });
  });

  it("file-failed with polling-timeout advances file state to 'failed'", () => {
    const { result } = renderHook(() =>
      useImageUpload({
        client: stubClient as unknown as Parameters<typeof useImageUpload>[0]["client"],
        namespaceSlug: "ns",
      }),
    );

    act(() => {
      result.current.addFiles([new File([new Uint8Array([1])], "e.jpg", { type: "image/jpeg" })]);
    });

    const fileId = result.current.files[0].id;
    const manager = capturedManagers[capturedManagers.length - 1];

    act(() => {
      manager.dispatchEvent(
        new CustomEvent("file-failed", {
          detail: { fileId, error: new Error("polling-timeout") },
        }),
      );
    });

    expect(result.current.files[0].state).toBe("failed");
    expect(result.current.files[0].error).toMatchObject({ message: "polling-timeout" });
  });

  it("forwards pollingIntervalMs, pollingMaxIntervalMs, pollingTimeoutMs to the manager", () => {
    const before = managerCtorArgs.length;
    renderHook(() =>
      useImageUpload({
        client: stubClient as unknown as Parameters<typeof useImageUpload>[0]["client"],
        namespaceSlug: "ns",
        pollingIntervalMs: 500,
        pollingMaxIntervalMs: 5_000,
        pollingTimeoutMs: 60_000,
      }),
    );
    const calls = managerCtorArgs.slice(before);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      pollingIntervalMs: 500,
      pollingMaxIntervalMs: 5_000,
      pollingTimeoutMs: 60_000,
    });
  });

  it("does not regress terminal tiles to 'uploading' when a second batch starts", () => {
    const { result } = renderHook(() =>
      useImageUpload({
        client: stubClient as unknown as Parameters<typeof useImageUpload>[0]["client"],
        namespaceSlug: "ns",
      }),
    );

    act(() => {
      result.current.addFiles([
        new File([new Uint8Array([1])], "first.jpg", { type: "image/jpeg" }),
      ]);
    });
    const firstId = result.current.files[0].id;
    const manager = capturedManagers[capturedManagers.length - 1] as LafkenUploadManager;

    // First batch reaches a terminal state.
    act(() => {
      manager.dispatchEvent(
        new CustomEvent("file-ready", {
          detail: {
            fileId: firstId,
            publicId: "pub-1",
            asset: { state: "ready", publicId: "pub-1" },
          },
        }),
      );
    });
    expect(result.current.files[0].state).toBe("ready");

    // Second batch starts.
    act(() => {
      result.current.addFiles([
        new File([new Uint8Array([2])], "second.jpg", { type: "image/jpeg" }),
      ]);
    });
    const uppy = manager.getUppy();
    act(() => {
      uppy.emit("upload", "batch-2", uppy.getFiles());
    });

    const first = result.current.files.find((f) => f.id === firstId);
    const second = result.current.files.find((f) => f.id !== firstId);
    expect(first?.state).toBe("ready");
    expect(second?.state).toBe("uploading");
  });

  it("maps a file to state 'error' when Uppy reports upload-error", () => {
    const { result } = renderHook(() =>
      useImageUpload({
        client: stubClient as unknown as Parameters<typeof useImageUpload>[0]["client"],
        namespaceSlug: "ns",
      }),
    );

    act(() => {
      result.current.addFiles([new File([new Uint8Array([1])], "err.jpg", { type: "image/jpeg" })]);
    });
    const manager = capturedManagers[capturedManagers.length - 1] as LafkenUploadManager;
    const uppy = manager.getUppy();
    const [uppyFile] = uppy.getFiles();

    act(() => {
      uppy.emit("upload-error", uppyFile, { name: "HTTPError", message: "403 Forbidden" });
    });

    expect(result.current.files[0].state).toBe("error");
    expect(result.current.files[0].error?.message).toBe("403 Forbidden");
  });

  it("unmount tears down: cancels polling and destroys the Uppy instance", () => {
    const { unmount } = renderHook(() =>
      useImageUpload({
        client: stubClient as unknown as Parameters<typeof useImageUpload>[0]["client"],
        namespaceSlug: "ns",
      }),
    );
    const manager = capturedManagers[capturedManagers.length - 1] as InstanceType<
      typeof LafkenUploadManager
    > & { cancelAllCalls: number };
    const destroySpy = vi.spyOn(manager.getUppy(), "destroy");

    unmount();

    expect(manager.cancelAllCalls).toBe(1);
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it("StrictMode double-mount tears down the orphan manager and keeps the hook functional", () => {
    const before = capturedManagers.length;
    const { result } = renderHook(
      () =>
        useImageUpload({
          client: stubClient as unknown as Parameters<typeof useImageUpload>[0]["client"],
          namespaceSlug: "ns",
        }),
      { wrapper: StrictMode },
    );

    // StrictMode: mount → cleanup → mount ⇒ two managers; the first was torn down.
    expect(capturedManagers.length - before).toBe(2);
    const first = capturedManagers[before] as InstanceType<typeof LafkenUploadManager> & {
      cancelAllCalls: number;
    };
    expect(first.cancelAllCalls).toBe(1);

    act(() => {
      result.current.addFiles([new File([new Uint8Array([1])], "s.jpg", { type: "image/jpeg" })]);
    });
    expect(result.current.files).toHaveLength(1);
  });

  it("stops polling after unmount (fake timers)", async () => {
    vi.stubGlobal("Image", FakeImage);
    vi.useFakeTimers();
    const get = vi.fn().mockResolvedValue({ state: "processing", publicId: "pub-poll" });
    const confirmUpload = vi.fn().mockResolvedValue({ publicId: "pub-poll", state: "processing" });
    const client = { assets: { createUploadIntent: vi.fn(), confirmUpload, get } };

    const { result, unmount } = renderHook(() =>
      useImageUpload({
        client: client as unknown as Parameters<typeof useImageUpload>[0]["client"],
        namespaceSlug: "ns",
        pollingIntervalMs: 1_000,
      }),
    );

    act(() => {
      result.current.addFiles([new File([new Uint8Array([1])], "p.jpg", { type: "image/jpeg" })]);
    });
    const manager = capturedManagers[capturedManagers.length - 1] as LafkenUploadManager;
    const uppy = manager.getUppy();
    const [uppyFile] = uppy.getFiles();
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
    (manager as any).publicIdByFileId.set(uppyFile.id, "pub-poll");
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

    await act(async () => {
      uppy.emit("complete", { successful: [uppyFile], failed: [] });
      await vi.advanceTimersByTimeAsync(0); // probe + confirm settle → poll loop enters its first sleep
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000); // first poll tick
    });
    expect(get).toHaveBeenCalledTimes(1);

    unmount();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(get).toHaveBeenCalledTimes(1); // no polls after unmount

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
