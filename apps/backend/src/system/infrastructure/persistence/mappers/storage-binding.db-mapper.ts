import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";

function toAdapterType(raw: string): "gcs" {
  if (raw === "gcs") {
    return raw;
  }
  throw new Error(`Unknown adapter_type value: "${raw}"`);
}

export class StorageBindingDbMapper {
  static toDomain(row: Record<string, any>): StorageBinding {
    return StorageBinding.fromProps({
      id: BigInt(row["id"]),
      name: row["name"] as string,
      adapterType: toAdapterType(row["adapter_type"] as string),
      config: (row["config"] as Record<string, unknown>) ?? {},
      createdAt: new Date(row["created_at"] as string),
      updatedAt: new Date(row["updated_at"] as string),
    });
  }
}
