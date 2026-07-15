import {
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
} from "@shared/backend-api/validation";
import { z } from "zod";

export { PRESET_FITS, PRESET_FORMATS };

export const presetParamsSchema = z.object({
  width: z.number().int().min(PRESET_DIMENSION_MIN).max(PRESET_DIMENSION_MAX).nullable().optional(),
  height: z
    .number()
    .int()
    .min(PRESET_DIMENSION_MIN)
    .max(PRESET_DIMENSION_MAX)
    .nullable()
    .optional(),
  fit: z.enum(PRESET_FITS),
  format: z.enum(PRESET_FORMATS),
  quality: z.number().int().min(PRESET_QUALITY_MIN).max(PRESET_QUALITY_MAX),
  dpr: z.number().min(PRESET_DPR_MIN).max(PRESET_DPR_MAX).nullable().optional(),
});

export const presetNameSchema = z
  .string()
  .min(1)
  .max(PRESET_NAME_MAX_LENGTH)
  .regex(PRESET_NAME_PATTERN, "lowercase kebab-case only");

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
