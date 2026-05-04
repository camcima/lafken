import { StorageBindingResponseDTO } from "@shared/backend-api";

import type { StorageBinding } from "@/system/domain/entities/storage-binding.entity";

export class StorageBindingResponseMapper {
  static fromDomain(binding: StorageBinding): StorageBindingResponseDTO {
    return {
      id: binding.props.id.toString(),
      name: binding.props.name,
      adapterType: binding.props.adapterType,
      config: binding.props.config,
      createdAt: binding.props.createdAt.toISOString(),
    };
  }
}
