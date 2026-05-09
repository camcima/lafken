import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";

import { LafkenApiError } from "../src/types";
import { Transport } from "../src/transport";

describe("Transport", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch") as MockInstance<typeof fetch>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET success returning JSON", () => {
    it("resolves with parsed JSON body on 200", async () => {
      const payload = { id: "asset-123", state: "ready" };
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const transport = new Transport({ baseUrl: "https://api.example.com" });
      const result = await transport.request("GET", "/v1/assets/asset-123");

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://api.example.com/v1/assets/asset-123");
      expect(calledInit?.method).toBe("GET");
      expect(calledInit?.body).toBeUndefined();
      expect(result).toEqual(payload);
    });

    it("resolves with parsed JSON body when a full URL is passed", async () => {
      const payload = { items: [] };
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const transport = new Transport({ baseUrl: "https://api.example.com" });
      const result = await transport.request("GET", "https://api.example.com/v1/assets?page=1");

      const [calledUrl] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://api.example.com/v1/assets?page=1");
      expect(result).toEqual(payload);
    });
  });

  describe("204 No Content", () => {
    it("returns undefined on 204", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));

      const transport = new Transport({ baseUrl: "https://api.example.com" });
      const result = await transport.request("DELETE", "/v1/assets/asset-123");

      expect(result).toBeUndefined();
    });
  });

  describe("4xx with application/problem+json", () => {
    it("throws LafkenApiError carrying problemDetails on 422", async () => {
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

      const transport = new Transport({ baseUrl: "https://api.example.com" });

      let thrownError: LafkenApiError | undefined;
      try {
        await transport.request("POST", "/v1/assets/upload-intents", { namespaceSlug: "gone" });
      } catch (err) {
        thrownError = err as LafkenApiError;
      }

      expect(thrownError).toBeInstanceOf(LafkenApiError);
      expect(thrownError?.status).toBe(422);
      expect(thrownError?.message).toBe("Namespace not found");
      expect(thrownError?.problemDetails).toEqual(problemDetails);
    });

    it("throws LafkenApiError on 404 with problem details", async () => {
      const problemDetails = {
        type: "about:blank",
        status: 404,
        title: "Not Found",
        detail: "Asset not found",
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(problemDetails), {
          status: 404,
          headers: { "Content-Type": "application/problem+json" },
        }),
      );

      const transport = new Transport({ baseUrl: "https://api.example.com" });

      await expect(transport.request("GET", "/v1/assets/missing")).rejects.toBeInstanceOf(
        LafkenApiError,
      );
    });

    it("throws LafkenApiError with fallback message when body is not JSON", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response("Service Unavailable", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        }),
      );

      const transport = new Transport({ baseUrl: "https://api.example.com" });

      let thrownError: LafkenApiError | undefined;
      try {
        await transport.request("GET", "/v1/assets/asset-123");
      } catch (err) {
        thrownError = err as LafkenApiError;
      }

      expect(thrownError).toBeInstanceOf(LafkenApiError);
      expect(thrownError?.status).toBe(503);
      expect(thrownError?.problemDetails).toBeNull();
      expect(thrownError?.message).toBe("Request failed with status 503");
    });
  });

  describe("authentication", () => {
    it("injects Authorization header when getAuthToken returns a token", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const getAuthToken = vi.fn().mockResolvedValue("my-token") as () => Promise<string | null>;
      const transport = new Transport({
        baseUrl: "https://api.example.com",
        getAuthToken,
      });

      await transport.request("GET", "/v1/assets/asset-123");

      expect(getAuthToken).toHaveBeenCalledOnce();
      const [, calledInit] = fetchSpy.mock.calls[0];
      const headers = calledInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer my-token");
    });

    it("omits Authorization header when getAuthToken returns null", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const getAuthToken = vi.fn().mockResolvedValue(null) as () => Promise<string | null>;
      const transport = new Transport({
        baseUrl: "https://api.example.com",
        getAuthToken,
      });

      await transport.request("GET", "/v1/assets/asset-123");

      const [, calledInit] = fetchSpy.mock.calls[0];
      const headers = calledInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
    });

    it("omits Authorization header when getAuthToken is not configured", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const transport = new Transport({ baseUrl: "https://api.example.com" });

      await transport.request("GET", "/v1/assets/asset-123");

      const [, calledInit] = fetchSpy.mock.calls[0];
      const headers = calledInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
    });
  });

  describe("base URL handling", () => {
    it("strips trailing slash from baseUrl before joining path", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const transport = new Transport({ baseUrl: "https://api.example.com/" });
      await transport.request("GET", "/v1/assets/asset-123");

      const [calledUrl] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://api.example.com/v1/assets/asset-123");
    });
  });
});
