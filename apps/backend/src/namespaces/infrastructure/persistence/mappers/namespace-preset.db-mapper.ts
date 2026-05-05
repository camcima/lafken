import { NamespacePreset } from "@/namespaces/domain/entities/namespace-preset.entity";
import { PresetParams } from "@/namespaces/domain/value-objects/preset-params.value-object";

export class NamespacePresetDbMapper {
  static toDomain(row: Record<string, unknown>): NamespacePreset {
    return NamespacePreset.fromProps({
      id: row["id"] as string,
      namespaceId: row["namespace_id"] as string,
      name: row["name"] as string,
      version: row["version"] as number,
      params: PresetParams.fromUnknown(row["params"]),
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
