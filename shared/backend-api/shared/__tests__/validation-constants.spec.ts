import { describe, expect, it } from "vitest";

import {
  LEGAL_HOLD_ASSET_IDS_MAX,
  LEGAL_HOLD_ASSET_IDS_MIN,
  LEGAL_HOLD_CASE_REFERENCE_MAX_LENGTH,
  LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH,
  LEGAL_HOLD_DESCRIPTION_MAX_LENGTH,
  LEGAL_HOLD_DESCRIPTION_MIN_LENGTH,
  NAMESPACE_DESCRIPTION_MAX_LENGTH,
  NAMESPACE_DISPLAY_NAME_MAX_LENGTH,
  NAMESPACE_SLUG_MAX_LENGTH,
  NAMESPACE_SLUG_PATTERN,
  POLICY_MAX_FILE_SIZE_BYTES,
  POLICY_MAX_RETENTION_DAYS,
  POLICY_MAX_SIGNED_URL_BUCKET_SIZE,
  POLICY_MAX_TTL_SECONDS,
  PRESET_DIMENSION_MAX,
  PRESET_DIMENSION_MIN,
  PRESET_DPR_MAX,
  PRESET_DPR_MIN,
  PRESET_FITS,
  PRESET_FORMATS,
  PRESET_NAME_MAX_LENGTH,
  PRESET_NAME_PATTERN,
  PRESET_QUALITY_MAX,
  PRESET_QUALITY_MIN,
} from "../validation-constants";

describe("validation-constants — namespaces", () => {
  it("accepts lowercase kebab-case slugs and rejects everything else", () => {
    expect(NAMESPACE_SLUG_PATTERN.test("aircraft-photos")).toBe(true);
    expect(NAMESPACE_SLUG_PATTERN.test("Aircraft-Photos")).toBe(false);
    expect(NAMESPACE_SLUG_PATTERN.test("aircraft--photos")).toBe(false);
    expect(NAMESPACE_SLUG_PATTERN.test("-aircraft-photos")).toBe(false);
  });

  it("exposes the documented namespace length limits", () => {
    expect(NAMESPACE_SLUG_MAX_LENGTH).toBe(64);
    expect(NAMESPACE_DISPLAY_NAME_MAX_LENGTH).toBe(200);
    expect(NAMESPACE_DESCRIPTION_MAX_LENGTH).toBe(2000);
  });
});

describe("validation-constants — namespace policies", () => {
  it("exposes the documented policy limits", () => {
    expect(POLICY_MAX_FILE_SIZE_BYTES).toBe(5_368_709_120);
    expect(POLICY_MAX_TTL_SECONDS).toBe(604_800);
    expect(POLICY_MAX_SIGNED_URL_BUCKET_SIZE).toBe(86_400);
    expect(POLICY_MAX_RETENTION_DAYS).toBe(36_500);
  });
});

describe("validation-constants — presets", () => {
  it("accepts lowercase kebab-case preset names and rejects everything else", () => {
    expect(PRESET_NAME_PATTERN.test("thumbnail")).toBe(true);
    expect(PRESET_NAME_PATTERN.test("thumb--nail")).toBe(true);
    expect(PRESET_NAME_PATTERN.test("-thumbnail")).toBe(false);
    expect(PRESET_NAME_PATTERN.test("Thumbnail")).toBe(false);
  });

  it("exposes the documented preset limits", () => {
    expect(PRESET_NAME_MAX_LENGTH).toBe(64);
    expect(PRESET_DIMENSION_MIN).toBe(1);
    expect(PRESET_DIMENSION_MAX).toBe(10_000);
    expect(PRESET_QUALITY_MIN).toBe(1);
    expect(PRESET_QUALITY_MAX).toBe(100);
    expect(PRESET_DPR_MIN).toBe(0.5);
    expect(PRESET_DPR_MAX).toBe(4);
  });

  it("exposes the documented fit and format enums", () => {
    expect(PRESET_FITS).toEqual(["cover", "contain", "fill", "inside", "outside"]);
    expect(PRESET_FORMATS).toEqual(["webp", "avif", "jpeg", "png", "auto"]);
  });
});

describe("validation-constants — legal holds", () => {
  it("exposes the documented legal hold limits", () => {
    expect(LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH).toBe(3);
    expect(LEGAL_HOLD_CASE_REFERENCE_MAX_LENGTH).toBe(100);
    expect(LEGAL_HOLD_DESCRIPTION_MIN_LENGTH).toBe(10);
    expect(LEGAL_HOLD_DESCRIPTION_MAX_LENGTH).toBe(1000);
    expect(LEGAL_HOLD_ASSET_IDS_MIN).toBe(1);
    expect(LEGAL_HOLD_ASSET_IDS_MAX).toBe(1000);
  });
});
