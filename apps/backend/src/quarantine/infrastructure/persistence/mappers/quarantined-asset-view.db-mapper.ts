import { QuarantinedAssetView } from "@/quarantine/domain/entities/quarantined-asset-view.entity";
import type { QuarantineKind } from "@/quarantine/domain/value-objects/quarantine-kind.value-object";

export class QuarantinedAssetViewDbMapper {
  static toDomain(row: Record<string, any>): QuarantinedAssetView {
    const state = row["state"] as string;
    const quarantineKind: QuarantineKind =
      state === "quarantined_virus"
        ? "virus"
        : state === "quarantined_invalid_format"
          ? "invalid_format"
          : "moderation";

    return QuarantinedAssetView.fromProps({
      id: row["id"] as string,
      publicId: row["public_id"] as string,
      namespaceSlug: row["namespace_slug"] as string,
      policyVersion: row["policy_version"] as number,
      state,
      stateReason: (row["state_reason"] as string | null) ?? null,
      sizeBytes:
        row["size_bytes"] !== null && row["size_bytes"] !== undefined
          ? BigInt(row["size_bytes"])
          : null,
      mimeType: (row["mime_type"] as string | null) ?? null,
      declaredMimeType: (row["declared_mime_type"] as string | null) ?? null,
      width: (row["width"] as number | null) ?? null,
      height: (row["height"] as number | null) ?? null,
      contentHash: row["content_hash"] instanceof Buffer ? row["content_hash"] : null,
      uploadedBy: (row["uploaded_by"] as string | null) ?? null,
      externalRefType: (row["external_ref_type"] as string | null) ?? null,
      externalRefId: (row["external_ref_id"] as string | null) ?? null,
      customMetadata: (row["custom_metadata"] as Record<string, unknown>) ?? {},
      captureContext: (row["capture_context"] as Record<string, unknown> | null) ?? null,
      tags: Array.isArray(row["tags"]) ? (row["tags"] as string[]) : [],
      legalHold: Boolean(row["legal_hold"]),
      confirmedAt: row["confirmed_at"] ? new Date(row["confirmed_at"] as string) : null,
      stateChangedAt: new Date(row["state_changed_at"] as string),
      createdAt: new Date(row["created_at"] as string),
      quarantineKind,
      // Latest-analysis lookup is deferred to Slice 1.
      // flagged* fields are null until that slice is implemented.
      flaggedAnalyzer: (row["flagged_analyzer"] as string | null) ?? null,
      flaggedCategory: (row["flagged_category"] as string | null) ?? null,
      flaggedScore: (row["flagged_score"] as number | null) ?? null,
      flaggedAt: new Date(row["flagged_at"] as string),
    });
  }
}
