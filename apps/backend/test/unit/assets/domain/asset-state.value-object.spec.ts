import { describe, expect, it } from "vitest";

import {
  ASSET_STATES,
  type AssetState,
  isAssetDownloadable,
} from "@/assets/domain/value-objects/asset-state.value-object";

const DOWNLOADABLE_STATES: AssetState[] = ["uploaded", "processing", "ready"];
const NON_DOWNLOADABLE_STATES: AssetState[] = ASSET_STATES.filter(
  (state) => !DOWNLOADABLE_STATES.includes(state),
);

describe("isAssetDownloadable", () => {
  it.each(DOWNLOADABLE_STATES)("allows minting a download URL in state %s", (state) => {
    expect(isAssetDownloadable(state)).toBe(true);
  });

  it.each(NON_DOWNLOADABLE_STATES)("refuses minting a download URL in state %s", (state) => {
    expect(isAssetDownloadable(state)).toBe(false);
  });
});
