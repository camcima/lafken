import { z } from "zod";

import type { GcsBindingConfig } from "@/system/domain/entities/storage-binding.entity";

const BUCKET_MIN_LENGTH = 3;
const BUCKET_MAX_LENGTH = 63;
const PROJECT_ID_MIN_LENGTH = 6;
const PROJECT_ID_MAX_LENGTH = 30;
const PREFIX_MAX_LENGTH = 255;

/**
 * Runtime validation for the "gcs" storage-binding config blob. This lives
 * in the application layer, not domain: it validates untrusted external
 * input (the raw `config: unknown` a caller sends in) at the boundary,
 * which is exactly the kind of concern hexagonal architecture assigns to
 * application/infrastructure — a framework-free domain must not depend on
 * a validation library. The schema is typed against the domain-owned
 * `GcsBindingConfig` shape (`@/system/domain/entities/storage-binding.entity`)
 * so the two cannot silently drift apart.
 */
export const gcsBindingConfigSchema: z.ZodType<GcsBindingConfig> = z.object({
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
