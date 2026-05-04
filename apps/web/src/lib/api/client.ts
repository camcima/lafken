import { z } from "zod";

import { getRuntimeValue } from "@/config/app-config";
import { getAuthProvider } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { validateData, ValidationError } from "@/lib/validation";

import { ApiError, type ApiErrorBody } from "./api-error";

type HttpMethods = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";

const HTTP_STATUS_NO_CONTENT = 204;

async function handleErrorResponse(response: Response): Promise<never> {
  const text = await response.text();
  let errorBody: unknown;

  try {
    errorBody = JSON.parse(text);
  } catch {
    errorBody = text;
  }

  logger.error("API request failed", new Error(`HTTP ${response.status}`), {
    status: response.status,
    statusText: response.statusText,
    body: errorBody,
  });

  if (isApiError(errorBody)) {
    throw new ApiError(response.status, response.statusText, errorBody);
  }

  throw new Error(`API request failed: ${response.status} ${response.statusText}`);
}

function isApiError(errorBody: unknown): errorBody is ApiErrorBody {
  return (
    typeof errorBody === "object" &&
    errorBody !== null &&
    "type" in errorBody &&
    "title" in errorBody &&
    "status" in errorBody &&
    "detail" in errorBody
  );
}

async function validateJsonResponse<T>(
  url: string,
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  let rawData: unknown;

  try {
    rawData = await response.json();
  } catch (error) {
    const parseError = error instanceof Error ? error : new Error(String(error));

    logger.error("Failed to parse response as JSON", parseError, {
      url,
      status: response.status,
    });

    throw new Error("Invalid JSON response from server", {
      cause: error,
    });
  }

  try {
    return validateData<T>(schema, rawData, "Invalid response data");
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.error("Response validation failed", error, {
        issues: error.issues,
        rawData: error.data,
        url,
      });
    }

    throw error;
  }
}

async function makeHttpHeaders(method: HttpMethods = "GET") {
  const authProvider = await getAuthProvider();
  const token = await authProvider.getAccessToken();

  if (!token) {
    throw new Error("No access token available — user may not be authenticated");
  }

  const headers = { Authorization: `Bearer ${token}` };

  if (method === "POST" || method === "PUT" || method === "PATCH") {
    return {
      headers: { ...headers, "Content-Type": "application/json" },
    };
  }

  return { headers };
}

function assertAllowedUrl(url: string): void {
  if (url.startsWith("/")) {
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`[SSRF Guard] Invalid URL: ${url}`);
  }

  const apiUrl = getRuntimeValue("API_URL");
  const allowedOrigin = new URL(apiUrl).origin;
  if (parsed.origin !== allowedOrigin) {
    throw new Error(
      `[SSRF Guard] Request to ${parsed.origin} blocked — only ${allowedOrigin} is allowed`,
    );
  }
}

function buildUrlWithParams(url: string, params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) {
    return url;
  }

  const base = url.startsWith("/") ? globalThis.location.origin : undefined;
  const parsed = new URL(url, base);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        parsed.searchParams.append(key, String(value));
      } else {
        parsed.searchParams.append(key, JSON.stringify(value));
      }
    }
  });

  if (base) {
    return `${parsed.pathname}${parsed.search}`;
  }
  return parsed.toString();
}

async function executeHttpRequest(
  url: string,
  requestFn: () => Promise<Response>,
): Promise<Response> {
  assertAllowedUrl(url);

  let response: Response;
  try {
    response = await requestFn();
  } catch (error) {
    if (error instanceof TypeError) {
      logger.error("Network request failed", error, {
        url,
        errorType: error.name,
        errorMessage: error.message,
      });
    }

    throw error;
  }

  if (!response.ok) {
    await handleErrorResponse(response);
  }
  return response;
}

export const apiClient = {
  get: async <T>(
    url: string,
    options?: {
      params?: Record<string, unknown>;
      schema?: z.ZodType<T>;
      signal?: AbortSignal;
    },
  ): Promise<T> => {
    const { headers } = await makeHttpHeaders();

    let finalUrl = url;
    const { params, schema } = options ?? {};

    if (params) {
      finalUrl = buildUrlWithParams(url, params);
    }

    const response = await executeHttpRequest(finalUrl, () =>
      fetch(finalUrl, { headers, signal: options?.signal }),
    );

    if (!schema) {
      return (await response.json()) as T;
    }

    return await validateJsonResponse<T>(finalUrl, response, schema);
  },

  post: async <T, U = T>(
    url: string,
    data: T,
    options?: {
      schema?: z.ZodType<U>;
      signal?: AbortSignal;
    },
  ): Promise<U> => {
    const { headers } = await makeHttpHeaders("POST");
    const { schema: responseSchema } = options ?? {};

    const response = await executeHttpRequest(url, () =>
      fetch(url, {
        headers,
        method: "POST",
        body: JSON.stringify(data),
        signal: options?.signal,
      }),
    );

    if (!responseSchema) {
      return (await response.json()) as U;
    }

    return await validateJsonResponse<U>(url, response, responseSchema);
  },

  put: async <T, U = T>(
    url: string,
    data: T,
    options?: {
      schema?: z.ZodType<U>;
      signal?: AbortSignal;
    },
  ): Promise<U> => {
    const { headers } = await makeHttpHeaders("PUT");
    const { schema: responseSchema } = options ?? {};

    const response = await executeHttpRequest(url, () =>
      fetch(url, {
        headers,
        method: "PUT",
        body: JSON.stringify(data),
        signal: options?.signal,
      }),
    );

    if (!responseSchema) {
      return (await response.json()) as U;
    }

    return await validateJsonResponse<U>(url, response, responseSchema);
  },

  patch: async <T, U = T>(
    url: string,
    data: T,
    options?: {
      schema?: z.ZodType<U>;
      signal?: AbortSignal;
    },
  ): Promise<U> => {
    const { headers } = await makeHttpHeaders("PATCH");
    const { schema: responseSchema } = options ?? {};

    const response = await executeHttpRequest(url, () =>
      fetch(url, {
        headers,
        method: "PATCH",
        body: JSON.stringify(data),
        signal: options?.signal,
      }),
    );

    if (!responseSchema) {
      return (await response.json()) as U;
    }

    return await validateJsonResponse<U>(url, response, responseSchema);
  },

  delete: async <T = void>(
    url: string,
    options?: {
      schema?: z.ZodType<T>;
      signal?: AbortSignal;
    },
  ): Promise<T> => {
    const { headers } = await makeHttpHeaders("DELETE");
    const { schema } = options ?? {};

    const response = await executeHttpRequest(url, () =>
      fetch(url, {
        headers,
        method: "DELETE",
        signal: options?.signal,
      }),
    );

    if (
      response.status === HTTP_STATUS_NO_CONTENT ||
      response.headers.get("Content-Length") === "0"
    ) {
      return undefined as T;
    }

    if (!schema) {
      return (await response.json()) as T;
    }

    return await validateJsonResponse<T>(url, response, schema);
  },

  health: async (url: string, options?: { signal?: AbortSignal }): Promise<Response> => {
    const { headers } = await makeHttpHeaders();

    return await executeHttpRequest(url, () => fetch(url, { headers, signal: options?.signal }));
  },
};
