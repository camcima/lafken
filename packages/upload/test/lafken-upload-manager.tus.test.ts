import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LafkenUploadManager } from "../src/lafken-upload-manager";

import { fakeClientFor } from "./helpers/fake-client";

describe("LafkenUploadManager protocol selection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers @uppy/tus when protocol='tus'", () => {
    const client = fakeClientFor({ protocol: "tus" });
    const manager = new LafkenUploadManager({
      client: client as never,
      namespaceSlug: "n",
      protocol: "tus",
    });
    const uppy = manager.getUppy();
    // Tus plugin id is "Tus" by default; XHRUpload's id is "XHRUpload".
    expect(uppy.getPlugin("Tus")).toBeTruthy();
    expect(uppy.getPlugin("XHRUpload")).toBeFalsy();
  });

  it("registers @uppy/xhr-upload when protocol is omitted (simple default)", () => {
    const client = fakeClientFor({ protocol: "simple" });
    const manager = new LafkenUploadManager({ client: client as never, namespaceSlug: "n" });
    const uppy = manager.getUppy();
    expect(uppy.getPlugin("XHRUpload")).toBeTruthy();
    expect(uppy.getPlugin("Tus")).toBeFalsy();
  });
});
