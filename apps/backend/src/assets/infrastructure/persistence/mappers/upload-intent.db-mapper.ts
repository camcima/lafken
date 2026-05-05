import { UploadIntent } from "@/assets/domain/entities/upload-intent.entity";

const ZERO_BIGINT = BigInt(0);

export class UploadIntentDbMapper {
  static toDomain(row: Record<string, any>): UploadIntent {
    return UploadIntent.fromProps({
      id: row["id"] as string,
      publicId: row["public_id"] as string,
      namespaceId: row["namespace_id"] as string,
      policyVersionId: row["policy_version_id"] as string,
      storageBindingId: row["storage_binding_id"] as string,
      storageKey: row["storage_key"] as string,
      declaredMimeType: (row["declared_mime_type"] as string | null) ?? "",
      declaredSizeBytes:
        row["declared_size_bytes"] !== null && row["declared_size_bytes"] !== undefined
          ? BigInt(row["declared_size_bytes"] as string | number | bigint)
          : ZERO_BIGINT,
      uploadUrl: row["upload_url"] as string,
      uploadUrlExpiresAt: new Date(row["upload_url_expires_at"] as string | Date),
      createdBy: (row["created_by"] as string | null) ?? null,
      consumedAt: row["consumed_at"] ? new Date(row["consumed_at"] as string | Date) : null,
      expiredAt: row["expired_at"] ? new Date(row["expired_at"] as string | Date) : null,
      createdAt: new Date(row["created_at"] as string | Date),
      updatedAt: new Date(row["updated_at"] as string | Date),
    });
  }
}
