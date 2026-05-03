import { NamespacePreset } from "@/namespaces/domain/entities/namespace-preset.entity";

export class NamespacePresetDbMapper {
  static toDomain(row: Record<string, any>): NamespacePreset {
    return NamespacePreset.fromProps({
      id: BigInt(row["id"]),
      namespaceId: BigInt(row["namespace_id"]),
      name: row["name"] as string,
      version: row["version"] as number,
      transformation: row["transformation"] as Record<string, unknown>,
      cdnMaxAge: (row["cdn_max_age"] as number | null) ?? null,
      signedUrlTtl: (row["signed_url_ttl"] as number | null) ?? null,
      preGenerate: row["pre_generate"] as boolean,
      requiredPermission: (row["required_permission"] as string | null) ?? null,
      description: (row["description"] as string | null) ?? null,
      active: row["active"] as boolean,
      createdAt: new Date(row["created_at"] as string),
    });
  }
}
