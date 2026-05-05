import { z } from "zod";

export const PRESET_FITS = ["cover", "contain", "fill", "inside", "outside"] as const;
export const PRESET_FORMATS = ["webp", "avif", "jpeg", "png", "auto"] as const;

const DIMENSION_MIN = 1;
const DIMENSION_MAX = 10000;
const QUALITY_MIN = 1;
const QUALITY_MAX = 100;
const DPR_MIN = 0.5;
const DPR_MAX = 4;
const PRESET_NAME_MAX_LENGTH = 64;

export const presetParamsSchema = z.object({
  width: z.number().int().min(DIMENSION_MIN).max(DIMENSION_MAX).nullable().optional(),
  height: z.number().int().min(DIMENSION_MIN).max(DIMENSION_MAX).nullable().optional(),
  fit: z.enum(PRESET_FITS),
  format: z.enum(PRESET_FORMATS),
  quality: z.number().int().min(QUALITY_MIN).max(QUALITY_MAX),
  dpr: z.number().min(DPR_MIN).max(DPR_MAX).nullable().optional(),
});

export const presetNameSchema = z
  .string()
  .min(1)
  .max(PRESET_NAME_MAX_LENGTH)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "lowercase kebab-case only");

export const createPresetSchema = z.object({
  name: presetNameSchema,
  params: presetParamsSchema,
});

export const updatePresetVersionSchema = z.object({
  params: presetParamsSchema,
});

export type IPresetParamsValues = z.infer<typeof presetParamsSchema>;
export type ICreatePresetValues = z.infer<typeof createPresetSchema>;
export type IUpdatePresetVersionValues = z.infer<typeof updatePresetVersionSchema>;
