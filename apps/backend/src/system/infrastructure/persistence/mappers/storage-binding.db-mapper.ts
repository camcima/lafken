import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";

const ADAPTER_TYPES = ["gcs", "s3", "local"] as const;
type AdapterType = (typeof ADAPTER_TYPES)[number];

function toAdapterType(raw: string): AdapterType {
  if (ADAPTER_TYPES.includes(raw as AdapterType)) {
    return raw as AdapterType;
  }
  throw new Error(`Unknown adapter_type value: "${raw}"`);
}

export class StorageBindingDbMapper {
  static toDomain(row: Record<string, any>): StorageBinding {
    const encryptedCredsRaw: unknown = row["encrypted_creds"];
    let encryptedCreds: Buffer | null = null;
    if (encryptedCredsRaw !== null && encryptedCredsRaw !== undefined) {
      encryptedCreds = Buffer.isBuffer(encryptedCredsRaw)
        ? encryptedCredsRaw
        : Buffer.from(encryptedCredsRaw as string);
    }

    return StorageBinding.fromProps({
      id: BigInt(row["id"]),
      name: row["name"] as string,
      adapterType: toAdapterType(row["adapter_type"] as string),
      config: (row["config"] as Record<string, unknown>) ?? {},
      encryptedCreds,
      createdAt: new Date(row["created_at"] as string),
      updatedAt: new Date(row["updated_at"] as string),
    });
  }
}
