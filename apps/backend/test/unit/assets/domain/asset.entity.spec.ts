import { describe, expect, it } from "vitest";

import type { AssetState } from "@/assets/domain/value-objects/asset-state.value-object";

import { makeAsset } from "../processing/processing-test-fixtures";

describe("Asset.canTransitionTo", () => {
  const cases: Array<{ from: AssetState; to: AssetState; legal: boolean }> = [
    // pipeline happy path
    { from: "uploaded", to: "processing", legal: true },
    { from: "processing", to: "ready", legal: true },
    { from: "processing", to: "rejected", legal: true },
    { from: "processing", to: "quarantined_virus", legal: true },
    { from: "processing", to: "quarantined_moderation", legal: true },
    { from: "processing", to: "processing_failed", legal: true },
    // operator flows
    { from: "processing_failed", to: "uploaded", legal: true },
    { from: "quarantined_virus", to: "ready", legal: true },
    { from: "quarantined_virus", to: "rejected", legal: true },
    { from: "quarantined_moderation", to: "ready", legal: true },
    { from: "quarantined_invalid_format", to: "rejected", legal: true },
    { from: "ready", to: "deleted", legal: true },
    { from: "uploaded", to: "deleted", legal: true },
    { from: "processing", to: "deleted", legal: true },
    { from: "ready", to: "expired", legal: true },
    // illegal moves the pipeline / sweepers must never make
    { from: "uploaded", to: "ready", legal: false },
    { from: "uploaded", to: "processing_failed", legal: false },
    { from: "deleted", to: "ready", legal: false },
    { from: "deleted", to: "processing", legal: false },
    { from: "expired", to: "uploaded", legal: false },
    { from: "ready", to: "processing", legal: false },
    { from: "rejected", to: "ready", legal: false },
  ];

  it.each(cases)("$from -> $to is legal=$legal", ({ from, to, legal }) => {
    expect(makeAsset({ state: from }).canTransitionTo(to)).toBe(legal);
  });

  it("terminal deleted state allows no outgoing transition at all", () => {
    const asset = makeAsset({ state: "deleted" });
    for (const to of [
      "pending",
      "uploaded",
      "processing",
      "ready",
      "rejected",
      "quarantined_virus",
      "quarantined_moderation",
      "quarantined_invalid_format",
      "processing_failed",
      "expired",
      "deleted",
    ] as AssetState[]) {
      expect(asset.canTransitionTo(to)).toBe(false);
    }
  });
});
