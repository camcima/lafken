import { Injectable } from "@nestjs/common";

import type { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

@Injectable()
export class ListStorageBindingsUseCase {
  constructor(private readonly repository: StorageBindingQueryRepositoryPort) {}

  async execute(): Promise<StorageBinding[]> {
    return this.repository.list();
  }
}
