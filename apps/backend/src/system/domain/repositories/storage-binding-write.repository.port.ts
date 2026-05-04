import type { StorageBinding } from "../entities/storage-binding.entity";

export abstract class StorageBindingWriteRepositoryPort {
  abstract insert(binding: StorageBinding): Promise<StorageBinding>;
  abstract update(binding: StorageBinding): Promise<StorageBinding>;
  abstract delete(name: string): Promise<void>;
}
