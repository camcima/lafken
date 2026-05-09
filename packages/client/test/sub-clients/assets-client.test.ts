import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";

import { LafkenApiError, LafkenClient } from "../../src/index";

describe("client.assets", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch") as MockInstance<typeof fetch>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── list ────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("GETs /v1/assets with no query params when called with empty opts", async () => {
      const payload = { data: [], page: 1, limit: 20, total: 0, lastPage: 1 };
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      const result = await client.assets.list();

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toContain("/v1/assets");
      expect(calledInit?.method).toBe("GET");
      expect(calledInit?.body).toBeUndefined();
      expect(result).toEqual(payload);
    });

    it("appends namespaceSlug and states as query params", async () => {
      const payload = { data: [], page: 1, limit: 20, total: 0, lastPage: 1 };
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      await client.assets.list({ namespaceSlug: "my-ns", states: ["ready", "processing"] });

      const [calledUrl] = fetchSpy.mock.calls[0];
      expect(calledUrl).toContain("namespaceSlug=my-ns");
      expect(calledUrl).toContain("states=ready");
      expect(calledUrl).toContain("states=processing");
    });
  });

  // ── get ─────────────────────────────────────────────────────────────────

  describe("get", () => {
    it("GETs /v1/assets/:publicId and returns the asset DTO", async () => {
      const asset = {
        id: "01936cc6-abc",
        publicId: "asset-123",
        namespaceSlug: "my-ns",
        policyVersion: 1,
        state: "ready",
        customMetadata: {},
        tags: [],
        legalHold: false,
        stateChangedAt: "2026-05-09T10:00:00Z",
        createdAt: "2026-05-09T09:00:00Z",
      };
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(asset), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      const result = await client.assets.get("asset-123");

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://api.example.com/v1/assets/asset-123");
      expect(calledInit?.method).toBe("GET");
      expect(result).toEqual(asset);
    });

    it("encodes reserved characters in publicId", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      await client.assets.get("abc%def");

      const [calledUrl] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://api.example.com/v1/assets/abc%25def");
    });
  });

  // ── createUploadIntent ───────────────────────────────────────────────────

  describe("createUploadIntent", () => {
    it("POSTs to /v1/assets/upload-intents with the input body", async () => {
      const mockResult = {
        publicId: "asset-123",
        protocol: "simple",
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
      const result = await client.assets.createUploadIntent({
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

    it("forwards the protocol field", async () => {
      const mockResult = {
        publicId: "pid-1",
        protocol: "tus",
        uploadUrl: "http://tusd/files/abc",
        uploadHeaders: { "Tus-Resumable": "1.0.0" },
        expiresAt: "2026-05-09T12:15:00.000Z",
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      const result = await client.assets.createUploadIntent({
        namespaceSlug: "n",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: 1,
        protocol: "tus",
      });

      expect(result.protocol).toBe("tus");
    });
  });

  // ── refreshUploadUrl ─────────────────────────────────────────────────────

  describe("refreshUploadUrl", () => {
    it("POSTs to /v1/assets/upload-intents/:publicId/refresh-url and returns the DTO", async () => {
      const mockResult = {
        uploadUrl: "https://gcs/new",
        uploadHeaders: { "Content-Type": "image/jpeg" },
        expiresAt: "2026-05-09T12:15:00.000Z",
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      const result = await client.assets.refreshUploadUrl("pid-1");

      expect(result.uploadUrl).toBe("https://gcs/new");
      const [calledUrl] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(
        "https://api.example.com/v1/assets/upload-intents/pid-1/refresh-url",
      );
    });

    it("propagates 422 as LafkenApiError", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 422, title: "Unprocessable Entity", detail: "consumed" }),
          { status: 422, headers: { "Content-Type": "application/problem+json" } },
        ),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      await expect(client.assets.refreshUploadUrl("pid-1")).rejects.toBeInstanceOf(LafkenApiError);
    });
  });

  // ── confirmUpload ────────────────────────────────────────────────────────

  describe("confirmUpload", () => {
    it("POSTs to /v1/assets/:publicId/confirm and returns the asset DTO", async () => {
      const mockAsset = {
        id: "01936cc6-abc",
        publicId: "asset-123",
        namespaceSlug: "my-namespace",
        policyVersion: 1,
        state: "uploaded",
        customMetadata: {},
        tags: [],
        legalHold: false,
        confirmedAt: "2026-05-05T12:00:00Z",
        stateChangedAt: "2026-05-05T12:00:00Z",
        createdAt: "2026-05-05T11:00:00Z",
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockAsset), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      const result = await client.assets.confirmUpload("asset-123");

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://api.example.com/v1/assets/asset-123/confirm");
      expect(calledInit?.method).toBe("POST");
      expect(JSON.parse(calledInit?.body as string)).toEqual({});
      expect(result).toEqual(mockAsset);
    });

    it("forwards width and height in the body when options are provided", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      await client.assets.confirmUpload("asset-123", { width: 100, height: 50 });

      const [, calledInit] = fetchSpy.mock.calls[0];
      const body = JSON.parse(calledInit?.body as string) as Record<string, unknown>;
      expect(body).toEqual({ width: 100, height: 50 });
    });
  });

  // ── getPreviewUrl ────────────────────────────────────────────────────────

  describe("getPreviewUrl", () => {
    it("GETs the preview URL endpoint and returns the full DTO { url, expiresAt }", async () => {
      const dto = { url: "https://imgproxy.example.com/foo", expiresAt: "2026-05-09T13:00:00Z" };
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(dto), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      const result = await client.assets.getPreviewUrl({ publicId: "asset-123", preset: "thumb" });

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(
        "https://api.example.com/v1/assets/asset-123/preview-url?preset=thumb",
      );
      expect(calledInit?.method).toBe("GET");
      expect(calledInit?.body).toBeUndefined();
      // Returns the full DTO, not just the url string
      expect(result).toEqual(dto);
      expect(result.url).toBe("https://imgproxy.example.com/foo");
      expect(result.expiresAt).toBe("2026-05-09T13:00:00Z");
    });

    it("encodes reserved characters in the publicId and preset query param", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ url: "https://imgproxy.example.com/bar", expiresAt: "2026-05-09T13:00:00Z" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      await client.assets.getPreviewUrl({ publicId: "abc%def", preset: "hero image" });

      const [calledUrl] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(
        "https://api.example.com/v1/assets/abc%25def/preview-url?preset=hero+image",
      );
    });

    it("throws LafkenApiError on 404", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 404, title: "Not Found", detail: "Asset not found" }),
          { status: 404, headers: { "Content-Type": "application/problem+json" } },
        ),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      await expect(
        client.assets.getPreviewUrl({ publicId: "missing", preset: "thumb" }),
      ).rejects.toBeInstanceOf(LafkenApiError);
    });
  });

  // ── getDownloadUrl ───────────────────────────────────────────────────────

  describe("getDownloadUrl", () => {
    it("GETs the download URL endpoint and returns the full DTO { url }", async () => {
      const dto = { url: "https://storage.example.com/blob.jpg?sig=x" };
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(dto), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      const result = await client.assets.getDownloadUrl({ publicId: "asset-123" });

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://api.example.com/v1/assets/asset-123/download-url");
      expect(calledInit?.method).toBe("GET");
      expect(calledInit?.body).toBeUndefined();
      expect(result).toEqual(dto);
      expect(result.url).toBe("https://storage.example.com/blob.jpg?sig=x");
    });

    it("encodes reserved characters in the publicId", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ url: "https://storage.example.com/blob.jpg" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      await client.assets.getDownloadUrl({ publicId: "abc%def" });

      const [calledUrl] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://api.example.com/v1/assets/abc%25def/download-url");
    });

    it("throws LafkenApiError on 404", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 404, title: "Not Found", detail: "Asset not found" }),
          { status: 404, headers: { "Content-Type": "application/problem+json" } },
        ),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      await expect(
        client.assets.getDownloadUrl({ publicId: "missing" }),
      ).rejects.toBeInstanceOf(LafkenApiError);
    });
  });

  // ── listStateTransitions ─────────────────────────────────────────────────

  describe("listStateTransitions", () => {
    it("GETs /v1/assets/:publicId/state-transitions and returns the list", async () => {
      const transitions = [
        {
          fromState: "pending",
          toState: "uploaded",
          occurredAt: "2026-05-09T10:01:00Z",
        },
      ];
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(transitions), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      const result = await client.assets.listStateTransitions("asset-123");

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(
        "https://api.example.com/v1/assets/asset-123/state-transitions",
      );
      expect(calledInit?.method).toBe("GET");
      expect(result).toEqual(transitions);
    });
  });

  // ── listAnalyses ─────────────────────────────────────────────────────────

  describe("listAnalyses", () => {
    it("GETs /v1/assets/:publicId/analyses and returns the list", async () => {
      const analyses = [
        {
          analyzer: "virus-scanner",
          findings: {},
          decision: "pass",
          occurredAt: "2026-05-09T10:02:00Z",
        },
      ];
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(analyses), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      const result = await client.assets.listAnalyses("asset-123");

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://api.example.com/v1/assets/asset-123/analyses");
      expect(calledInit?.method).toBe("GET");
      expect(result).toEqual(analyses);
    });
  });

  // ── getProcessingJob ─────────────────────────────────────────────────────

  describe("getProcessingJob", () => {
    it("GETs /v1/assets/:publicId/processing-job and returns the job DTO", async () => {
      const job = {
        state: "completed",
        attemptNumber: 1,
        createdAt: "2026-05-09T10:00:00Z",
      };
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(job), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      const result = await client.assets.getProcessingJob("asset-123");

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://api.example.com/v1/assets/asset-123/processing-job");
      expect(calledInit?.method).toBe("GET");
      expect(result).toEqual(job);
    });
  });

  // ── retryProcessing ──────────────────────────────────────────────────────

  describe("retryProcessing", () => {
    it("POSTs to /v1/assets/:publicId/retry-processing with empty body", async () => {
      fetchSpy.mockResolvedValueOnce(new Response("", { status: 200 }));

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      await client.assets.retryProcessing("asset-123");

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://api.example.com/v1/assets/asset-123/retry-processing");
      expect(calledInit?.method).toBe("POST");
      expect(JSON.parse(calledInit?.body as string)).toEqual({});
    });

    it("encodes reserved characters in the publicId", async () => {
      fetchSpy.mockResolvedValueOnce(new Response("", { status: 200 }));

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      await client.assets.retryProcessing("abc%def");

      const [calledUrl] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://api.example.com/v1/assets/abc%25def/retry-processing");
    });

    it("throws LafkenApiError on 422", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 422,
            title: "Unprocessable Entity",
            detail: "Asset is not in processing_failed",
          }),
          { status: 422, headers: { "Content-Type": "application/problem+json" } },
        ),
      );

      const client = new LafkenClient({ baseUrl: "https://api.example.com" });
      await expect(client.assets.retryProcessing("asset-123")).rejects.toBeInstanceOf(
        LafkenApiError,
      );
    });
  });

  // ── authentication (spot check) ──────────────────────────────────────────

  describe("authentication", () => {
    it("injects Authorization header on assets.createUploadIntent", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            publicId: "p",
            protocol: "simple",
            uploadUrl: "u",
            uploadHeaders: {},
            expiresAt: "2026-05-09T12:00:00Z",
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      );

      const getAuthToken = vi.fn().mockResolvedValue("tok") as () => Promise<string | null>;
      const client = new LafkenClient({
        baseUrl: "https://api.example.com",
        getAuthToken,
      });

      await client.assets.createUploadIntent({
        namespaceSlug: "ns",
        declaredMimeType: "image/png",
        declaredSizeBytes: 100,
      });

      expect(getAuthToken).toHaveBeenCalledOnce();
      const [, calledInit] = fetchSpy.mock.calls[0];
      const headers = calledInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer tok");
    });
  });
});
