export const ASSET_STATES = [
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
] as const;

export type AssetState = (typeof ASSET_STATES)[number];

/**
 * Storage-key prefix applied when an asset is moved out of imgproxy's reach
 * on quarantine. Previously-issued imgproxy URLs embed the original key, so
 * after the move they 404 — which is exactly what we want for quarantined
 * bytes. Single source of truth for both the worker (move-on-quarantine) and
 * the release use case (move-back).
 */
export const QUARANTINE_KEY_PREFIX = "_quarantined/";

export function toQuarantinedStorageKey(originalKey: string): string {
  if (originalKey.startsWith(QUARANTINE_KEY_PREFIX)) return originalKey;
  return `${QUARANTINE_KEY_PREFIX}${originalKey}`;
}

export function fromQuarantinedStorageKey(quarantinedKey: string): string {
  if (!quarantinedKey.startsWith(QUARANTINE_KEY_PREFIX)) return quarantinedKey;
  return quarantinedKey.slice(QUARANTINE_KEY_PREFIX.length);
}

/**
 * States where an asset's bytes can be safely surfaced through the public
 * imgproxy preview path. Quarantined / rejected / deleted assets must not
 * have preview URLs minted — the bytes have either been moved to
 * `_quarantined/` (virus / moderation), are non-images (rejected /
 * invalid_format), or shouldn't be served at all (deleted / expired).
 */
const PREVIEWABLE_ASSET_STATES: ReadonlySet<AssetState> = new Set([
  "uploaded",
  "processing",
  "ready",
]);

export function isAssetPreviewable(state: AssetState): boolean {
  return PREVIEWABLE_ASSET_STATES.has(state);
}

/**
 * States where an asset's original bytes may be handed out through a signed
 * download URL. Mirrors the preview allowlist today, but download and preview
 * are distinct capabilities kept as separate predicates so they can diverge
 * (e.g. a compliance flow could someday allow downloading rejected originals
 * that must never be previewable). Quarantine physically moves the bytes to
 * `_quarantined/<key>` and updates `storage_key` in the same UPDATE, so an
 * unguarded signed URL would point at the quarantined bytes and *work* —
 * this predicate is the gate that prevents that (implementation review F-S1).
 */
const DOWNLOADABLE_ASSET_STATES: ReadonlySet<AssetState> = new Set([
  "uploaded",
  "processing",
  "ready",
]);

export function isAssetDownloadable(state: AssetState): boolean {
  return DOWNLOADABLE_ASSET_STATES.has(state);
}
