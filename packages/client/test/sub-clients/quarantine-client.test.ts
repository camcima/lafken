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

describe("client.quarantine", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch") as MockInstance<typeof fetch>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("GETs /v1/quarantine and returns paginated result", async () => {
      const payload = { data: [], page: 1, limit: 20, total: 0, lastPage: 1 };
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.quarantine.list();

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toContain("/v1/quarantine");
      expect(calledInit?.method).toBe("GET");
      expect(result).toEqual(payload);
    });

    it("appends query params when provided", async () => {
      const payload = { data: [], page: 1, limit: 20, total: 0, lastPage: 1 };
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      await client.quarantine.list({ namespaceSlug: "my-ns", page: 2 });

      const [calledUrl] = fetchSpy.mock.calls[0];
      expect(calledUrl).toContain("namespaceSlug=my-ns");
      expect(calledUrl).toContain("page=2");
    });
  });

  // ── release ───────────────────────────────────────────────────────────────

  describe("release", () => {
    it("POSTs to /v1/quarantine/:publicId/release with note body", async () => {
      const asset = { id: "a-1", publicId: "pub-1", state: "ready" };
      fetchSpy.mockResolvedValueOnce(okJson(asset));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.quarantine.release("pub-1", { note: "looks clean" });

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/quarantine/pub-1/release`);
      expect(calledInit?.method).toBe("POST");
      expect(JSON.parse(calledInit?.body as string)).toEqual({ note: "looks clean" });
      expect(result).toEqual(asset);
    });
  });

  // ── reject ────────────────────────────────────────────────────────────────

  describe("reject", () => {
    it("POSTs to /v1/quarantine/:publicId/reject with note body", async () => {
      const asset = { id: "a-1", publicId: "pub-1", state: "rejected" };
      fetchSpy.mockResolvedValueOnce(okJson(asset));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.quarantine.reject("pub-1", { note: "contains malware" });

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/quarantine/pub-1/reject`);
      expect(calledInit?.method).toBe("POST");
      expect(JSON.parse(calledInit?.body as string)).toEqual({ note: "contains malware" });
      expect(result).toEqual(asset);
    });
  });
});
