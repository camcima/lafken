import { Injectable } from "@nestjs/common";

import type { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { StorageBindingNotFoundError } from "@/system/domain/errors/storage-binding-not-found.error";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";
import { StorageBindingWriteRepositoryPort } from "@/system/domain/repositories/storage-binding-write.repository.port";

interface IDeleteStorageBindingInput {
  name: string;
}

@Injectable()
export class DeleteStorageBindingUseCase {
  constructor(
    private readonly queryRepository: StorageBindingQueryRepositoryPort,
    private readonly writeRepository: StorageBindingWriteRepositoryPort,
  ) {}

  async execute(input: IDeleteStorageBindingInput): Promise<void> {
    const existing: StorageBinding | null = await this.queryRepository.findByName(input.name);
    if (!existing) {
      throw new StorageBindingNotFoundError({ name: input.name });
    }

    await this.writeRepository.delete(input.name);
  }
}
