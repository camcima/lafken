import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";

import { LafkenApiError, LafkenClient } from "../src/index";

describe("LafkenClient", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch") as MockInstance<typeof fetch>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createUploadIntent", () => {
    it("POSTs to the correct URL with the input body", async () => {
      const mockResult = {
        publicId: "asset-123",
        uploadUrl: "https://storage.example.com/upload",
        uploadHeaders: { "x-goog-meta-test": "value" },
        expiresAt: "2026-05-05T12:00:00Z",
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      const result = await client.createUploadIntent({
        namespaceSlug: "my-namespace",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: 1024,
      });

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://api.example.com/v1/assets/upload-intents");
      expect(calledInit?.method).toBe("POST");
      expect(JSON.parse(calledInit?.body as string)).toEqual({
        namespaceSlug: "my-namespace",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: 1024,
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe("confirmUpload", () => {
    it("POSTs to the correct URL for the given publicId", async () => {
      const mockAsset = {
        publicId: "asset-123",
        namespaceSlug: "my-namespace",
        state: "uploaded",
        storageKey: "namespaces/my-namespace/asset-123",
        declaredMimeType: "image/jpeg",
        sizeBytes: 1024,
        uploadedBy: null,
        confirmedAt: "2026-05-05T12:00:00Z",
        createdAt: "2026-05-05T11:00:00Z",
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockAsset), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      const result = await client.confirmUpload("asset-123");

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://api.example.com/v1/assets/asset-123/confirm");
      expect(calledInit?.method).toBe("POST");
      expect(JSON.parse(calledInit?.body as string)).toEqual({});
      expect(result).toEqual(mockAsset);
    });

    it("forwards width and height in the body when options are provided", async () => {
      const mockAsset = {
        publicId: "asset-123",
        namespaceSlug: "my-namespace",
        state: "uploaded",
        storageKey: "namespaces/my-namespace/asset-123",
        declaredMimeType: "image/jpeg",
        sizeBytes: 1024,
        uploadedBy: null,
        confirmedAt: "2026-05-05T12:00:00Z",
        createdAt: "2026-05-05T11:00:00Z",
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockAsset), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      await client.confirmUpload("asset-123", { width: 100, height: 50 });

      const [, calledInit] = fetchSpy.mock.calls[0];
      const body = JSON.parse(calledInit?.body as string) as Record<string, unknown>;
      expect(body).toEqual({ width: 100, height: 50 });
    });
  });

  describe("error handling", () => {
    it("throws LafkenApiError with parsed problem details on 4xx responses", async () => {
      const problemDetails = {
        type: "about:blank",
        status: 422,
        title: "Unprocessable Entity",
        detail: "Namespace not found",
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(problemDetails), {
          status: 422,
          headers: { "Content-Type": "application/problem+json" },
        }),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });

      let thrownError: LafkenApiError | undefined;
      try {
        await client.createUploadIntent({
          namespaceSlug: "nonexistent",
          declaredMimeType: "image/jpeg",
          declaredSizeBytes: 1024,
        });
      } catch (err) {
        thrownError = err as LafkenApiError;
      }

      expect(thrownError).toBeInstanceOf(LafkenApiError);
      expect(thrownError?.status).toBe(422);
      expect(thrownError?.message).toBe("Namespace not found");
      expect(thrownError?.problemDetails).toEqual(problemDetails);
    });
  });

  describe("authentication", () => {
    it("adds Authorization header when getAuthToken returns a token", async () => {
      const mockResult = {
        publicId: "asset-456",
        uploadUrl: "https://storage.example.com/upload",
        uploadHeaders: {},
        expiresAt: "2026-05-05T12:00:00Z",
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const getAuthToken = vi.fn().mockResolvedValue("my-secret-token") as () => Promise<
        string | null
      >;
      const client = new LafkenClient({
        baseUrl: "https://api.example.com",
        getAuthToken,
      });

      await client.createUploadIntent({
        namespaceSlug: "my-namespace",
        declaredMimeType: "image/png",
        declaredSizeBytes: 2048,
      });

      expect(getAuthToken).toHaveBeenCalledOnce();
      const [, calledInit] = fetchSpy.mock.calls[0];
      const headers = calledInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer my-secret-token");
    });
  });
});
