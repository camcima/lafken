import { describe, expect, it } from "vitest";

import { RefreshUploadUrlResponseDTO } from "../refresh-upload-url-response.dto";

describe("RefreshUploadUrlResponseDTO", () => {
  it("exposes uploadUrl, uploadHeaders, expiresAt", () => {
    const dto = new RefreshUploadUrlResponseDTO();
    dto.uploadUrl = "u";
    dto.uploadHeaders = { "Content-Type": "image/jpeg" };
    dto.expiresAt = "2026-05-09T12:00:00.000Z";
    expect(dto.uploadUrl).toBe("u");
    expect(dto.uploadHeaders["Content-Type"]).toBe("image/jpeg");
    expect(dto.expiresAt).toBe("2026-05-09T12:00:00.000Z");
  });
});
