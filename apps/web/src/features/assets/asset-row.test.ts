import type { AssetResponseDTO } from "@shared/backend-api";
import { describe, expect, it } from "vitest";

import { assetResponseToRow } from "./asset-row";

function makeDto(overrides: Partial<AssetResponseDTO> = {}): AssetResponseDTO {
  return {
    publicId: "01900000-0000-7000-8000-000000000040",
    namespaceSlug: "photos-ns",
    policyVersion: 1,
    state: "uploaded",
    customMetadata: {},
    legalHold: false,
    stateChangedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    previewUrls: {},
    ...overrides,
  };
}

describe("assetResponseToRow", () => {
  it("uses the first previewUrl as thumbUrl when one is present", () => {
    const row = assetResponseToRow(
      makeDto({
        previewUrls: {
          "thumb-sm": "https://imgproxy.test/foo",
          "thumb-md": "https://imgproxy.test/bar",
        },
      }),
    );
    expect(row.thumbUrl).toBe("https://imgproxy.test/foo");
  });

  it("leaves thumbUrl undefined when previewUrls is empty", () => {
    const row = assetResponseToRow(makeDto({ previewUrls: {} }));
    expect(row.thumbUrl).toBeUndefined();
  });

  it("leaves thumbUrl undefined when previewUrls is missing from the DTO", () => {
    // Older response shapes from a stale BE may not include previewUrls.
    const dto = makeDto();
    // @ts-expect-error simulating a legacy DTO shape without previewUrls
    delete dto.previewUrls;
    const row = assetResponseToRow(dto);
    expect(row.thumbUrl).toBeUndefined();
  });
});
