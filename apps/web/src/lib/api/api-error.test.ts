import { describe, expect, it } from "vitest";

import { ApiError, type ApiErrorBody } from "./api-error";

describe("ApiError", () => {
  const mockBody: ApiErrorBody = {
    type: "https://tools.ietf.org/html/rfc7231#section-6.5.1",
    title: "Bad Request",
    status: 400,
    detail: "Invalid request parameters",
    code: "INVALID_PARAMS",
    params: { field: "email" },
  };

  it("creates an ApiError with all properties", () => {
    const error = new ApiError(400, "Bad Request", mockBody);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
    expect(error.status).toBe(400);
    expect(error.statusText).toBe("Bad Request");
    expect(error.body).toEqual(mockBody);
    expect(error.message).toBe("API request failed: 400 Bad Request");
  });

  it("creates an ApiError with minimal body", () => {
    const minimalBody: ApiErrorBody = {
      status: 404,
    };
    const error = new ApiError(404, "Not Found", minimalBody);

    expect(error.status).toBe(404);
    expect(error.statusText).toBe("Not Found");
    expect(error.body).toEqual(minimalBody);
  });

  it("creates an ApiError with empty body", () => {
    const emptyBody: ApiErrorBody = {};
    const error = new ApiError(500, "Internal Server Error", emptyBody);

    expect(error.status).toBe(500);
    expect(error.statusText).toBe("Internal Server Error");
    expect(error.body).toEqual(emptyBody);
  });

  it("preserves error body structure", () => {
    const complexBody: ApiErrorBody = {
      type: "validation_error",
      title: "Validation Failed",
      status: 422,
      detail: "Multiple validation errors",
      code: "VALIDATION_ERROR",
      params: {
        errors: [
          { field: "email", message: "Invalid email" },
          { field: "password", message: "Too short" },
        ],
      },
    };

    const error = new ApiError(422, "Unprocessable Entity", complexBody);

    expect(error.body.params).toEqual(complexBody.params);
    expect(error.body.code).toBe("VALIDATION_ERROR");
  });
});
