import { describe, expect, it } from "vitest";

import { SYSTEM_PRESETS } from "@/assets/domain/value-objects/system-presets";
import { SYSTEM_PRESET_NAME_PREFIX } from "@/shared/kernel/domain/preset-naming";

describe("SYSTEM_PRESETS", () => {
  it("includes lafken:thumbnail with sensible default spec", () => {
    const thumb = SYSTEM_PRESETS.find((p) => p.name === "lafken:thumbnail");
    expect(thumb).toBeDefined();
    expect(thumb!.spec).toEqual({
      width: 200,
      height: 200,
      fit: "contain",
      format: "webp",
      quality: 80,
      dpr: null,
    });
  });

  it("includes lafken:detail-hero sized for the asset detail view", () => {
    const hero = SYSTEM_PRESETS.find((p) => p.name === "lafken:detail-hero");
    expect(hero).toBeDefined();
    expect(hero!.spec).toEqual({
      width: 1200,
      height: null,
      fit: "contain",
      format: "webp",
      quality: 85,
      dpr: null,
    });
  });

  it("every system preset name uses the reserved prefix", () => {
    for (const preset of SYSTEM_PRESETS) {
      expect(preset.name.startsWith(SYSTEM_PRESET_NAME_PREFIX)).toBe(true);
    }
  });

  it("exports the prefix as 'lafken:'", () => {
    expect(SYSTEM_PRESET_NAME_PREFIX).toBe("lafken:");
  });
});
