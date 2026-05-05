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
});
