import { describe, expect, it } from "vitest";

import {
  InvalidPresetParamsError,
  PresetParams,
} from "@/namespaces/domain/value-objects/preset-params.value-object";

describe("PresetParams", () => {
  const VALID = {
    width: 800,
    height: 600,
    fit: "cover",
    format: "webp",
    quality: 80,
    dpr: 2,
  };

  it("accepts a fully valid object", () => {
    const p = PresetParams.fromUnknown(VALID);
    expect(p.props).toMatchObject({ width: 800, height: 600, fit: "cover", quality: 80 });
  });

  it("accepts nullable fields as null", () => {
    const p = PresetParams.fromUnknown({ ...VALID, width: null, height: null, dpr: null });
    expect(p.props.width).toBeNull();
    expect(p.props.height).toBeNull();
    expect(p.props.dpr).toBeNull();
  });

  it("rejects width below 1", () => {
    expect(() => PresetParams.fromUnknown({ ...VALID, width: 0 })).toThrow(
      InvalidPresetParamsError,
    );
  });

  it("rejects unknown fit", () => {
    expect(() => PresetParams.fromUnknown({ ...VALID, fit: "stretch" })).toThrow(
      InvalidPresetParamsError,
    );
  });

  it("rejects unknown format", () => {
    expect(() => PresetParams.fromUnknown({ ...VALID, format: "tiff" })).toThrow(
      InvalidPresetParamsError,
    );
  });

  it("rejects quality 0 and 101", () => {
    expect(() => PresetParams.fromUnknown({ ...VALID, quality: 0 })).toThrow(
      InvalidPresetParamsError,
    );
    expect(() => PresetParams.fromUnknown({ ...VALID, quality: 101 })).toThrow(
      InvalidPresetParamsError,
    );
  });

  it("rejects dpr 0.4 and 4.1", () => {
    expect(() => PresetParams.fromUnknown({ ...VALID, dpr: 0.4 })).toThrow(
      InvalidPresetParamsError,
    );
    expect(() => PresetParams.fromUnknown({ ...VALID, dpr: 4.1 })).toThrow(
      InvalidPresetParamsError,
    );
  });

  it("aggregates multiple violations into one error", () => {
    try {
      PresetParams.fromUnknown({ width: -1, height: 0, fit: "x", format: "y", quality: 999 });
      expect.fail("should have thrown");
    } catch (err) {
      if (!(err instanceof InvalidPresetParamsError)) throw err;
      const violations = (err.params?.violations ?? []) as Array<{ field: string }>;
      const fields = violations.map((v) => v.field).sort();
      expect(fields).toContain("width");
      expect(fields).toContain("height");
      expect(fields).toContain("fit");
      expect(fields).toContain("format");
      expect(fields).toContain("quality");
    }
  });
});
