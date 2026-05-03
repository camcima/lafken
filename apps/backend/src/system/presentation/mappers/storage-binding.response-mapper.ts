import { StorageBindingResponseDTO } from "@shared/backend-api";

import type { StorageBinding } from "@/system/domain/entities/storage-binding.entity";

export class StorageBindingResponseMapper {
  static fromDomain(binding: StorageBinding): StorageBindingResponseDTO {
    return {
      name: binding.props.name,
      adapterType: binding.props.adapterType,
      config: binding.props.config,
      encryptedCredsPresent: binding.props.encryptedCreds !== null,
      createdAt: binding.props.createdAt.toISOString(),
    };
  }
}
