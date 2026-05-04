import { z } from "zod";

const BUCKET_MIN_LENGTH = 3;
const BUCKET_MAX_LENGTH = 63;
const PROJECT_ID_MIN_LENGTH = 6;
const PROJECT_ID_MAX_LENGTH = 30;
const PREFIX_MAX_LENGTH = 255;

export const gcsBindingConfigSchema = z.object({
  bucket: z
    .string()
    .min(BUCKET_MIN_LENGTH)
    .max(BUCKET_MAX_LENGTH)
    // GCS bucket naming subset: lowercase alphanumeric, dot, hyphen, underscore;
    // must start and end with alphanumeric. Length and full GCS rules (no consecutive
    // dots, no IP-address-like names) are enforced server-side by GCS.
    .regex(/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/),
  projectId: z.string().min(PROJECT_ID_MIN_LENGTH).max(PROJECT_ID_MAX_LENGTH),
  prefix: z.string().max(PREFIX_MAX_LENGTH).optional(),
});

export type GcsBindingConfig = z.infer<typeof gcsBindingConfigSchema>;
