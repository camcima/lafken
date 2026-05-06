import type { IPreviewSpec } from "@/assets/domain/services/preview-url-signer.port";

export { SYSTEM_PRESET_NAME_PREFIX } from "@/shared/kernel/domain/preset-naming";

export interface ISystemPreset {
  name: string;
  spec: IPreviewSpec;
}

/**
 * System-managed presets, available across every namespace without per-tenant
 * configuration. Owned by the Lafken codebase; new entries land via PR.
 */
export const SYSTEM_PRESETS: ReadonlyArray<ISystemPreset> = [
  {
    name: "lafken:thumbnail",
    spec: {
      width: 200,
      height: 200,
      fit: "contain",
      format: "webp",
      quality: 80,
      dpr: null,
    },
  },
  {
    name: "lafken:detail-hero",
    spec: {
      width: 1200,
      height: null,
      fit: "contain",
      format: "webp",
      quality: 85,
      dpr: null,
    },
  },
];
