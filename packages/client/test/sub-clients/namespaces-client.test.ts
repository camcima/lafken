import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";

import { LafkenClient } from "../../src/index";

const BASE = "https://api.example.com";

function okJson(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("client.namespaces", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch") as MockInstance<typeof fetch>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── list ─────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("GETs /v1/namespaces and returns paginated result", async () => {
      const payload = { data: [], page: 1, limit: 20, total: 0, lastPage: 1 };
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.namespaces.list();

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toContain("/v1/namespaces");
      expect(calledInit?.method).toBe("GET");
      expect(result).toEqual(payload);
    });
  });

  // ── get ──────────────────────────────────────────────────────────────────

  describe("get", () => {
    it("GETs /v1/namespaces/:slug", async () => {
      const payload = { id: "ns-1", slug: "my-ns" };
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.namespaces.get("my-ns");

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/namespaces/my-ns`);
      expect(calledInit?.method).toBe("GET");
      expect(result).toEqual(payload);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("POSTs to /v1/namespaces with the body", async () => {
      const payload = { id: "ns-new", slug: "new-ns" };
      fetchSpy.mockResolvedValueOnce(okJson(payload, 201));

      const client = new LafkenClient({ baseUrl: BASE });
      const input = {
        slug: "new-ns",
        displayName: "New NS",
        storageBindingId: "sb-1",
        policy: {
          retentionDays: 30,
          retentionMode: "compliance" as const,
          maxFileSizeBytes: 1048576,
          allowedMimeTypes: ["image/jpeg"],
          virusScanRequired: true,
          contentModeration: false,
          requiredMetadataSchema: {},
          immutable: false,
          servingMode: "signed" as const,
          signedUrlTtlSeconds: 3600,
          signedUrlBucketSize: 100,
          retryConfig: { maxAttempts: 3, initialDelayMs: 1000, backoffMultiplier: 2 },
        },
      };
      const result = await client.namespaces.create(input);

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/namespaces`);
      expect(calledInit?.method).toBe("POST");
      expect(result).toEqual(payload);
    });
  });

  // ── updateMetadata ────────────────────────────────────────────────────────

  describe("updateMetadata", () => {
    it("PATCHes /v1/namespaces/:slug with the patch body", async () => {
      const payload = { id: "ns-1", slug: "my-ns", displayName: "Updated" };
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.namespaces.updateMetadata("my-ns", { displayName: "Updated" });

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/namespaces/my-ns`);
      expect(calledInit?.method).toBe("PATCH");
      expect(result).toEqual(payload);
    });
  });

  // ── archive ───────────────────────────────────────────────────────────────

  describe("archive", () => {
    it("POSTs to /v1/namespaces/:slug/archive", async () => {
      const payload = { id: "ns-1", slug: "my-ns" };
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.namespaces.archive("my-ns");

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/namespaces/my-ns/archive`);
      expect(calledInit?.method).toBe("POST");
      expect(result).toEqual(payload);
    });
  });

  // ── unarchive ─────────────────────────────────────────────────────────────

  describe("unarchive", () => {
    it("POSTs to /v1/namespaces/:slug/unarchive", async () => {
      const payload = { id: "ns-1", slug: "my-ns" };
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.namespaces.unarchive("my-ns");

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/namespaces/my-ns/unarchive`);
      expect(calledInit?.method).toBe("POST");
      expect(result).toEqual(payload);
    });
  });

  // ── listPolicies ──────────────────────────────────────────────────────────

  describe("listPolicies", () => {
    it("GETs /v1/namespaces/:slug/policies", async () => {
      const payload = [{ version: 1 }];
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.namespaces.listPolicies("my-ns");

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/namespaces/my-ns/policies`);
      expect(calledInit?.method).toBe("GET");
      expect(result).toEqual(payload);
    });
  });

  // ── createPolicyVersion ───────────────────────────────────────────────────

  describe("createPolicyVersion", () => {
    it("POSTs to /v1/namespaces/:slug/policy-versions with body", async () => {
      const payload = { id: "ns-1", slug: "my-ns" };
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      const input = {
        policy: {
          retentionDays: 60,
          retentionMode: "governance" as const,
          maxFileSizeBytes: 2097152,
          allowedMimeTypes: ["image/png"],
          virusScanRequired: false,
          contentModeration: false,
          requiredMetadataSchema: {},
          immutable: false,
          servingMode: "public" as const,
          signedUrlTtlSeconds: 0,
          signedUrlBucketSize: 0,
          retryConfig: { maxAttempts: 3, initialDelayMs: 1000, backoffMultiplier: 2 },
        },
      };
      const result = await client.namespaces.createPolicyVersion("my-ns", input);

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/namespaces/my-ns/policy-versions`);
      expect(calledInit?.method).toBe("POST");
      expect(result).toEqual(payload);
    });
  });

  // ── listPresets ───────────────────────────────────────────────────────────

  describe("listPresets", () => {
    it("GETs /v1/namespaces/:slug/presets", async () => {
      const payload = [{ name: "thumb" }];
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.namespaces.listPresets("my-ns");

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/namespaces/my-ns/presets`);
      expect(calledInit?.method).toBe("GET");
      expect(result).toEqual(payload);
    });
  });

  // ── createPreset ──────────────────────────────────────────────────────────

  describe("createPreset", () => {
    it("POSTs to /v1/namespaces/:slug/presets with body", async () => {
      const payload = { name: "thumb", active: true };
      fetchSpy.mockResolvedValueOnce(okJson(payload, 201));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.namespaces.createPreset("my-ns", {
        name: "thumb",
        params: { type: "image_resize", width: 100, height: 100, fit: "cover" },
      });

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/namespaces/my-ns/presets`);
      expect(calledInit?.method).toBe("POST");
      expect(result).toEqual(payload);
    });
  });

  // ── updatePresetVersion ───────────────────────────────────────────────────

  describe("updatePresetVersion", () => {
    it("POSTs to /v1/namespaces/:slug/presets/:name/versions with body", async () => {
      const payload = { name: "thumb", active: true };
      fetchSpy.mockResolvedValueOnce(okJson(payload, 201));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.namespaces.updatePresetVersion("my-ns", "thumb", {
        params: { type: "image_resize", width: 200, height: 200, fit: "cover" },
      });

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/namespaces/my-ns/presets/thumb/versions`);
      expect(calledInit?.method).toBe("POST");
      expect(result).toEqual(payload);
    });
  });

  // ── setPresetActive ───────────────────────────────────────────────────────

  describe("setPresetActive", () => {
    it("PATCHes /v1/namespaces/:slug/presets/:name with the active body", async () => {
      const payload = { name: "thumb", active: false };
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.namespaces.setPresetActive("my-ns", "thumb", { active: false });

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/namespaces/my-ns/presets/thumb`);
      expect(calledInit?.method).toBe("PATCH");
      expect(result).toEqual(payload);
    });
  });
});
