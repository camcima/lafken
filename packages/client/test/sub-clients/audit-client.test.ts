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

describe("client.audit", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch") as MockInstance<typeof fetch>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("GETs /v1/audit and returns paginated result", async () => {
      const payload = { data: [], page: 1, limit: 20, total: 0, lastPage: 1 };
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.audit.list();

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toContain("/v1/audit");
      expect(calledInit?.method).toBe("GET");
      expect(result).toEqual(payload);
    });

    it("appends query params when provided", async () => {
      const payload = { data: [], page: 1, limit: 20, total: 0, lastPage: 1 };
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      await client.audit.list({ principal: "user@example.com", entityType: "asset" });

      const [calledUrl] = fetchSpy.mock.calls[0];
      expect(calledUrl).toContain("principal=user%40example.com");
      expect(calledUrl).toContain("entityType=asset");
    });
  });
});
