import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError } from "./api-error";
import { apiClient } from "./client";

// Mock dependencies
vi.mock("@/config/app-config", () => ({
  getRuntimeValue: vi.fn((key: string) => {
    if (key === "API_URL") return "http://localhost:3000";
    return "";
  }),
}));

vi.mock("@/lib/auth", () => ({
  getAuthProvider: vi.fn(() => ({
    getAccessToken: vi.fn(() => Promise.resolve("mock-token")),
  })),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/validation", () => ({
  validateData: vi.fn(<T>(schema: z.ZodType<T>, data: unknown): T => {
    return schema.parse(data);
  }),
  ValidationError: class ValidationError extends Error {
    constructor(
      message: string,
      public issues: unknown[],
      public data?: unknown,
    ) {
      super(message);
    }
  },
}));

describe("apiClient", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("get", () => {
    it("makes GET request with authorization header", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: "test" }),
      } as unknown as Response;

      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      await apiClient.get("/api/test");

      expect(globalThis.fetch).toHaveBeenCalledWith("/api/test", {
        headers: { Authorization: "Bearer mock-token" },
        signal: undefined,
      });
    });

    it("includes query parameters in URL", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: "test" }),
      } as unknown as Response;

      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      await apiClient.get("/api/test", {
        params: { page: 1, limit: 10 },
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("page=1"),
        expect.any(Object),
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=10"),
        expect.any(Object),
      );
    });

    it("handles URL with existing query parameters", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: "test" }),
      } as unknown as Response;

      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      await apiClient.get("/api/test?existing=param", {
        params: { new: "value" },
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("existing=param&new=value"),
        expect.any(Object),
      );
    });

    it("validates response with schema", async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ name: "John", age: 30 }),
      } as unknown as Response;

      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      const result = await apiClient.get("/api/test", { schema });

      expect(result).toEqual({ name: "John", age: 30 });
    });

    it("handles abort signal", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: "test" }),
      } as unknown as Response;

      const abortController = new AbortController();
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      await apiClient.get("/api/test", { signal: abortController.signal });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          signal: abortController.signal,
        }),
      );
    });

    it("throws ApiError on non-ok response", async () => {
      const errorBody = {
        type: "error",
        title: "Not Found",
        status: 404,
        detail: "Resource not found",
      };

      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: vi.fn().mockResolvedValue(JSON.stringify(errorBody)),
      } as unknown as Response;

      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      await expect(apiClient.get("/api/test")).rejects.toThrow(ApiError);
    });
  });

  describe("post", () => {
    it("makes POST request with JSON body", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 1 }),
      } as unknown as Response;

      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      await apiClient.post("/api/users", { name: "John", age: 30 });

      expect(globalThis.fetch).toHaveBeenCalledOnce();
      const [url, options] = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(url).toBe("/api/users");
      expect(options).toBeDefined();
      const fetchOptions = options as RequestInit;
      expect(fetchOptions.method).toBe("POST");
      expect(fetchOptions.body).toBe(JSON.stringify({ name: "John", age: 30 }));
      const headers = fetchOptions.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["Authorization"]).toBe("Bearer mock-token");
    });

    it("validates response with schema", async () => {
      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 1, name: "John" }),
      } as unknown as Response;

      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      const result = await apiClient.post("/api/users", { name: "John" }, { schema });

      expect(result).toEqual({ id: 1, name: "John" });
    });

    it("handles abort signal", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 1 }),
      } as unknown as Response;

      const abortController = new AbortController();
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      await apiClient.post(
        "/api/users",
        { name: "John" },
        {
          signal: abortController.signal,
        },
      );

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/users",
        expect.objectContaining({
          signal: abortController.signal,
        }),
      );
    });
  });

  describe("delete", () => {
    it("resolves to undefined when the response is 204 No Content", async () => {
      const jsonSpy = vi.fn();
      const mockResponse = {
        ok: true,
        status: 204,
        headers: { get: vi.fn().mockReturnValue(null) },
        json: jsonSpy,
      } as unknown as Response;

      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      await expect(apiClient.delete("/api/users/123")).resolves.toBeUndefined();
      expect(jsonSpy).not.toHaveBeenCalled();

      const [url, options] = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(url).toBe("/api/users/123");
      const fetchOptions = options as RequestInit;
      expect(fetchOptions.method).toBe("DELETE");
      const headers = fetchOptions.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer mock-token");
    });

    it("resolves to undefined when the response has Content-Length 0", async () => {
      const jsonSpy = vi.fn();
      const mockResponse = {
        ok: true,
        status: 200,
        headers: { get: vi.fn((key: string) => (key === "Content-Length" ? "0" : null)) },
        json: jsonSpy,
      } as unknown as Response;

      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      await expect(apiClient.delete("/api/users/123")).resolves.toBeUndefined();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it("parses the JSON body when the response has content", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: { get: vi.fn().mockReturnValue(null) },
        json: vi.fn().mockResolvedValue({ deleted: true }),
      } as unknown as Response;

      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      const result = await apiClient.delete<{ deleted: boolean }>("/api/users/123");

      expect(result).toEqual({ deleted: true });
    });
  });

  describe("health", () => {
    it("makes GET request without authorization", async () => {
      const mockResponse = {
        ok: true,
      } as unknown as Response;

      const headers = {
        Authorization: "Bearer mock-token",
      };

      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      const result = await apiClient.health("/health");

      expect(globalThis.fetch).toHaveBeenCalledWith("/health", { headers });
      expect(result).toBe(mockResponse);
    });

    it("throws error when response is not ok", async () => {
      const mockResponse = {
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        json: vi.fn().mockRejectedValue(new Error("Not JSON")),
        text: vi.fn().mockResolvedValue("Service Unavailable"),
      } as unknown as Response;

      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      // health endpoint uses executeHttpRequest which throws on non-ok
      await expect(apiClient.health("/health")).rejects.toThrow();
    });
  });

  describe("SSRF protection", () => {
    it("allows relative URLs", async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) } as unknown as Response;
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      await expect(apiClient.get("/api/test")).resolves.toBeDefined();
    });

    it("allows absolute URLs matching BE origin", async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) } as unknown as Response;
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      await expect(apiClient.get("http://localhost:3000/v1/users")).resolves.toBeDefined();
    });

    it("blocks absolute URLs to different origins", async () => {
      await expect(apiClient.get("http://evil.com/steal-data")).rejects.toThrow("[SSRF Guard]");
    });

    it("blocks requests to internal services on different ports", async () => {
      await expect(apiClient.get("http://localhost:9090/admin")).rejects.toThrow("[SSRF Guard]");
    });
  });
});
