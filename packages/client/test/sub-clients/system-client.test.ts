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

describe("client.system", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch") as MockInstance<typeof fetch>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── listStorageBindings ───────────────────────────────────────────────────

  describe("listStorageBindings", () => {
    it("GETs /v1/system/storage-bindings and returns the list", async () => {
      const payload = [{ name: "gcs-primary" }];
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.system.listStorageBindings();

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/system/storage-bindings`);
      expect(calledInit?.method).toBe("GET");
      expect(result).toEqual(payload);
    });
  });

  // ── getStorageBinding ─────────────────────────────────────────────────────

  describe("getStorageBinding", () => {
    it("GETs /v1/system/storage-bindings/:name", async () => {
      const payload = { name: "gcs-primary", adapterType: "gcs" };
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.system.getStorageBinding("gcs-primary");

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/system/storage-bindings/gcs-primary`);
      expect(calledInit?.method).toBe("GET");
      expect(result).toEqual(payload);
    });
  });

  // ── createStorageBinding ──────────────────────────────────────────────────

  describe("createStorageBinding", () => {
    it("POSTs to /v1/system/storage-bindings with body", async () => {
      const payload = { name: "gcs-primary", adapterType: "gcs" };
      fetchSpy.mockResolvedValueOnce(okJson(payload, 201));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.system.createStorageBinding({
        name: "gcs-primary",
        adapterType: "gcs",
        config: { bucket: "my-bucket" },
      });

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/system/storage-bindings`);
      expect(calledInit?.method).toBe("POST");
      expect(result).toEqual(payload);
    });
  });

  // ── updateStorageBinding ──────────────────────────────────────────────────

  describe("updateStorageBinding", () => {
    it("PATCHes /v1/system/storage-bindings/:name with body", async () => {
      const payload = { name: "gcs-primary", adapterType: "gcs" };
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.system.updateStorageBinding("gcs-primary", {
        config: { bucket: "new-bucket" },
      });

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/system/storage-bindings/gcs-primary`);
      expect(calledInit?.method).toBe("PATCH");
      expect(result).toEqual(payload);
    });
  });

  // ── deleteStorageBinding ──────────────────────────────────────────────────

  describe("deleteStorageBinding", () => {
    it("DELETEs /v1/system/storage-bindings/:name", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));

      const client = new LafkenClient({ baseUrl: BASE });
      await client.system.deleteStorageBinding("gcs-primary");

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/system/storage-bindings/gcs-primary`);
      expect(calledInit?.method).toBe("DELETE");
    });
  });

  // ── listIntegrations ──────────────────────────────────────────────────────

  describe("listIntegrations", () => {
    it("GETs /v1/system/integrations and returns the list", async () => {
      const payload = [{ name: "virus-scanner", status: "healthy" }];
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.system.listIntegrations();

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/system/integrations`);
      expect(calledInit?.method).toBe("GET");
      expect(result).toEqual(payload);
    });
  });

  // ── getHealth ─────────────────────────────────────────────────────────────

  describe("getHealth", () => {
    it("GETs /v1/system/health and returns the health snapshot", async () => {
      const payload = { status: "healthy", components: [] };
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.system.getHealth();

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/system/health`);
      expect(calledInit?.method).toBe("GET");
      expect(result).toEqual(payload);
    });
  });
});
