import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LafkenUploadManager } from "../src/lafken-upload-manager";
import { fakeClientFor, fakeImageFile } from "./helpers/fake-client";

describe("LafkenUploadManager refresh-before-upload", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("calls refreshUploadUrl when expiresAt is within the safety margin", async () => {
    const client = fakeClientFor({
      // Initial expiresAt 10s in the future; default margin is 30s → must refresh.
      initialExpiresInMs: 10_000,
      refreshExpiresInMs: 900_000,
    });
    const manager = new LafkenUploadManager({
      client: client as never,
      namespaceSlug: "n",
      refreshSafetyMarginMs: 30_000,
    });
    manager.addFiles([fakeImageFile("a.jpg")]);
    const uppy = manager.getUppy();
    const [file] = uppy.getFiles();
    expect(file).toBeDefined();

    // Drive the pre-processor directly; this is what start() will invoke.
    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
    await (manager as any).runPreProcessing([file.id]);
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */

    expect(client.refreshUploadUrlCalls.map((c) => c.publicId)).toEqual([
      client.createUploadIntentCalls[0].response.publicId,
    ]);
  });

  it("emits file-failed when refresh fails (e.g., already swept)", async () => {
    const client = fakeClientFor({
      initialExpiresInMs: 10_000,
      refreshError: new Error("422 expired"),
    });
    const manager = new LafkenUploadManager({ client: client as never, namespaceSlug: "n" });
    const failures: unknown[] = [];
    manager.addEventListener("file-failed", (e) => failures.push((e as CustomEvent).detail));
    manager.addFiles([fakeImageFile("a.jpg")]);
    const uppy = manager.getUppy();
    const [file] = uppy.getFiles();
    expect(file).toBeDefined();

    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
    await (manager as any).runPreProcessing([file.id]);
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */

    expect(failures).toHaveLength(1);
  });

  it("refreshes when expiresAt is unparseable (treated as already expired)", async () => {
    const client = fakeClientFor({
      // A malformed expiresAt makes `getTime()` NaN. Every NaN comparison is
      // false, so a naive `expiresAt - now < margin` check silently skips the
      // pre-flight refresh and uploads against a possibly-dead signed URL.
      initialExpiresAtRaw: "not-a-date",
      refreshExpiresInMs: 900_000,
    });
    const manager = new LafkenUploadManager({
      client: client as never,
      namespaceSlug: "n",
      refreshSafetyMarginMs: 30_000,
    });
    manager.addFiles([fakeImageFile("a.jpg")]);
    const uppy = manager.getUppy();
    const [file] = uppy.getFiles();
    expect(file).toBeDefined();

    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
    await (manager as any).runPreProcessing([file.id]);
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */

    expect(client.refreshUploadUrlCalls.map((c) => c.publicId)).toEqual([
      client.createUploadIntentCalls[0].response.publicId,
    ]);
  });

  it("does NOT call refreshUploadUrl when expiresAt is well outside the margin", async () => {
    const client = fakeClientFor({
      // 1 hour in future; default margin is 30s → no refresh.
      initialExpiresInMs: 3_600_000,
    });
    const manager = new LafkenUploadManager({
      client: client as never,
      namespaceSlug: "n",
      refreshSafetyMarginMs: 30_000,
    });
    manager.addFiles([fakeImageFile("b.jpg")]);
    const uppy = manager.getUppy();
    const [file] = uppy.getFiles();
    expect(file).toBeDefined();

    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
    await (manager as any).runPreProcessing([file.id]);
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */

    expect(client.refreshUploadUrlCalls).toHaveLength(0);
  });
});
