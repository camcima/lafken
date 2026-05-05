import {
  EXIFHandling,
  NamespacePolicy,
  RetentionMode,
  ServingMode,
} from "@/namespaces/domain/entities/namespace-policy.entity";

export class NamespacePolicyDbMapper {
  static toDomain(row: Record<string, any>): NamespacePolicy {
    return NamespacePolicy.fromProps({
      id: row["id"] as string,
      namespaceId: row["namespace_id"] as string,
      version: row["version"] as number,
      retentionDays: (row["retention_days"] as number | null) ?? null,
      retentionMode: row["retention_mode"] as RetentionMode,
      maxFileSizeBytes: BigInt(row["max_file_size_bytes"]),
      allowedMimeTypes: row["allowed_mime_types"] as string[],
      exifHandling: row["exif_handling"] as EXIFHandling,
      virusScanRequired: row["virus_scan_required"] as boolean,
      contentModeration: (row["content_moderation"] as Record<string, unknown> | null) ?? null,
      requiredMetadataSchema:
        (row["required_metadata_schema"] as Record<string, unknown> | null) ?? null,
      immutable: row["immutable"] as boolean,
      servingMode: row["serving_mode"] as ServingMode,
      signedUrlTtlSeconds: (row["signed_url_ttl_seconds"] as number | null) ?? null,
      signedUrlBucketSize: (row["signed_url_bucket_size"] as number | null) ?? null,
      retryConfig: (row["retry_config"] as Record<string, unknown> | null) ?? null,
      createdBy: (row["created_by"] as string | null) ?? null,
      createdAt: new Date(row["created_at"] as string),
    });
  }
}
