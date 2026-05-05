import type { IPreviewSpec } from "@/assets/domain/services/preview-url-signer.port";

/**
 * Reserved prefix for Lafken-internal preset names. Namespace-defined preset
 * names MUST NOT start with this prefix — that's enforced by the create/update
 * preset use cases.
 */
export const SYSTEM_PRESET_NAME_PREFIX = "lafken:";

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
];
