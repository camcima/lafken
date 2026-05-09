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

describe("client.legalHolds", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch") as MockInstance<typeof fetch>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("GETs /v1/legal-holds and returns paginated result", async () => {
      const payload = { data: [], page: 1, limit: 20, total: 0, lastPage: 1 };
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.legalHolds.list();

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toContain("/v1/legal-holds");
      expect(calledInit?.method).toBe("GET");
      expect(result).toEqual(payload);
    });
  });

  // ── get ───────────────────────────────────────────────────────────────────

  describe("get", () => {
    it("GETs /v1/legal-holds/:id", async () => {
      const hold = { id: "hold-1", caseReference: "CASE-001" };
      fetchSpy.mockResolvedValueOnce(okJson(hold));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.legalHolds.get("hold-1");

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/legal-holds/hold-1`);
      expect(calledInit?.method).toBe("GET");
      expect(result).toEqual(hold);
    });
  });

  // ── place ─────────────────────────────────────────────────────────────────

  describe("place", () => {
    it("POSTs to /v1/legal-holds with body", async () => {
      const hold = { id: "hold-2", caseReference: "CASE-002" };
      fetchSpy.mockResolvedValueOnce(okJson(hold, 201));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.legalHolds.place({
        caseReference: "CASE-002",
        description: "Investigation",
        assetIds: ["asset-1", "asset-2"],
      });

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/legal-holds`);
      expect(calledInit?.method).toBe("POST");
      expect(result).toEqual(hold);
    });
  });

  // ── lift ──────────────────────────────────────────────────────────────────

  describe("lift", () => {
    it("POSTs to /v1/legal-holds/:id/lift with body", async () => {
      const hold = { id: "hold-1", caseReference: "CASE-001", active: false };
      fetchSpy.mockResolvedValueOnce(okJson(hold));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.legalHolds.lift("hold-1", { liftReason: "Resolved" });

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/legal-holds/hold-1/lift`);
      expect(calledInit?.method).toBe("POST");
      expect(JSON.parse(calledInit?.body as string)).toEqual({ liftReason: "Resolved" });
      expect(result).toEqual(hold);
    });
  });
});
