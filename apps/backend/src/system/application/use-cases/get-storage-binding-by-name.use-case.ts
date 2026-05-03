import { Injectable } from "@nestjs/common";

import type { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { StorageBindingNotFoundError } from "@/system/domain/errors/storage-binding-not-found.error";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

@Injectable()
export class GetStorageBindingByNameUseCase {
  constructor(private readonly repository: StorageBindingQueryRepositoryPort) {}

  async execute(input: { name: string }): Promise<StorageBinding> {
    const binding = await this.repository.findByName(input.name);
    if (!binding) {
      throw new StorageBindingNotFoundError({ name: input.name });
    }
    return binding;
  }
}
