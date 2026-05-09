import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LafkenApiError, LafkenClient } from "../src";

describe("LafkenClient.refreshUploadUrl + protocol on createUploadIntent", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts to /upload-intents/:publicId/refresh-url and returns the body", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          uploadUrl: "https://gcs/new",
          uploadHeaders: { "Content-Type": "image/jpeg" },
          expiresAt: "2026-05-09T12:15:00.000Z",
        }),
    } as never);

    const client = new LafkenClient({ baseUrl: "http://api.test" });
    const result = await client.refreshUploadUrl("pid-1");
    expect(result.uploadUrl).toBe("https://gcs/new");
    expect(result.uploadHeaders["Content-Type"]).toBe("image/jpeg");
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      "http://api.test/v1/assets/upload-intents/pid-1/refresh-url",
    );
  });

  it("forwards the protocol field on createUploadIntent", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      text: async () =>
        JSON.stringify({
          publicId: "pid-1",
          protocol: "tus",
          uploadUrl: "http://tusd/files/abc",
          uploadHeaders: { "Tus-Resumable": "1.0.0", "Upload-Length": "1" },
          expiresAt: "2026-05-09T12:15:00.000Z",
        }),
    } as never);
    const client = new LafkenClient({ baseUrl: "http://api.test" });
    const result = await client.createUploadIntent({
      namespaceSlug: "n",
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: 1,
      protocol: "tus",
    });
    expect(result.protocol).toBe("tus");
    expect(result.uploadUrl).toBe("http://tusd/files/abc");
    const body = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
    );
    expect(body.protocol).toBe("tus");
  });

  it("propagates 422 as LafkenApiError", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 422,
      text: async () =>
        JSON.stringify({ status: 422, title: "Unprocessable Entity", detail: "consumed" }),
    } as never);
    const client = new LafkenClient({ baseUrl: "http://api.test" });
    await expect(client.refreshUploadUrl("pid-1")).rejects.toBeInstanceOf(LafkenApiError);
  });
});
