import { act, renderHook } from "@testing-library/react";
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
    constructor(opts: ConstructorParameters<typeof OriginalManager>[0]) {
      managerCtorArgs.push(opts);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      super(opts as any);
      capturedManagers.push(this);
    }
  }
  return { ...mod, LafkenUploadManager: SpiedManager };
});

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
});
