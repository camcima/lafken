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

describe("client.dashboard", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch") as MockInstance<typeof fetch>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── getOverview ───────────────────────────────────────────────────────────

  describe("getOverview", () => {
    it("GETs /v1/dashboard/overview and returns the overview DTO", async () => {
      const payload = { totalAssets: 42, totalNamespaces: 3 };
      fetchSpy.mockResolvedValueOnce(okJson(payload));

      const client = new LafkenClient({ baseUrl: BASE });
      const result = await client.dashboard.getOverview();

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/v1/dashboard/overview`);
      expect(calledInit?.method).toBe("GET");
      expect(result).toEqual(payload);
    });
  });
});
