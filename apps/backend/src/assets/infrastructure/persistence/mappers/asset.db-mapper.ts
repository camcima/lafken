import { Asset } from "@/assets/domain/entities/asset.entity";
import type { AssetState } from "@/assets/domain/value-objects/asset-state.value-object";

export class AssetDbMapper {
  static toDomain(row: Record<string, any>): Asset {
    return Asset.fromProps({
      id: BigInt(row["id"]),
      publicId: row["public_id"] as string,
      namespaceId: BigInt(row["namespace_id"]),
      policyVersionId: BigInt(row["policy_version_id"]),
      storageBindingId: BigInt(row["storage_binding_id"]),
      storageKey: row["storage_key"] as string,
      state: row["state"] as AssetState,
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
      owningRecordType: (row["owning_record_type"] as string | null) ?? null,
      owningRecordId: (row["owning_record_id"] as string | null) ?? null,
      customMetadata: (row["custom_metadata"] as Record<string, unknown>) ?? {},
      captureContext: (row["capture_context"] as Record<string, unknown> | null) ?? null,
      legalHold: Boolean(row["legal_hold"]),
      confirmedAt: row["confirmed_at"] ? new Date(row["confirmed_at"] as string) : null,
      stateChangedAt: new Date(row["state_changed_at"] as string),
      createdAt: new Date(row["created_at"] as string),
      updatedAt: new Date(row["updated_at"] as string),
    });
  }
}
