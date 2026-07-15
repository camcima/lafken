/**
 * Single source of truth for request-validation limits, shared by the API
 * DTOs (class-validator decorators) and the web console forms (Zod schemas).
 *
 * MUST stay free of imports: the web app value-imports this file through the
 * `@shared/backend-api/validation` subpath, and any dependency here would be
 * dragged into the browser bundle.
 */

// ── Namespaces ────────────────────────────────────────────────────────────
export const NAMESPACE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const NAMESPACE_SLUG_MAX_LENGTH = 64;
export const NAMESPACE_DISPLAY_NAME_MAX_LENGTH = 200;
export const NAMESPACE_DESCRIPTION_MAX_LENGTH = 2000;

// ── Namespace policies ────────────────────────────────────────────────────
export const POLICY_MAX_FILE_SIZE_BYTES = 5_368_709_120; // 5 GiB
export const POLICY_MAX_TTL_SECONDS = 604_800; // 7 days
export const POLICY_MAX_SIGNED_URL_BUCKET_SIZE = 86_400;
export const POLICY_MAX_RETENTION_DAYS = 36_500;

// ── Presets ───────────────────────────────────────────────────────────────
export const PRESET_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const PRESET_NAME_MAX_LENGTH = 64;
export const PRESET_DIMENSION_MIN = 1;
export const PRESET_DIMENSION_MAX = 10_000;
export const PRESET_QUALITY_MIN = 1;
export const PRESET_QUALITY_MAX = 100;
export const PRESET_DPR_MIN = 0.5;
export const PRESET_DPR_MAX = 4;
export const PRESET_FITS = ["cover", "contain", "fill", "inside", "outside"] as const;
export const PRESET_FORMATS = ["webp", "avif", "jpeg", "png", "auto"] as const;

// ── Legal holds ───────────────────────────────────────────────────────────
export const LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH = 3;
export const LEGAL_HOLD_CASE_REFERENCE_MAX_LENGTH = 100;
export const LEGAL_HOLD_DESCRIPTION_MIN_LENGTH = 10;
export const LEGAL_HOLD_DESCRIPTION_MAX_LENGTH = 1000;
export const LEGAL_HOLD_ASSET_IDS_MIN = 1;
export const LEGAL_HOLD_ASSET_IDS_MAX = 1000;
