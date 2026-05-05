import type { StorageBinding } from "../entities/storage-binding.entity";

export abstract class StorageBindingQueryRepositoryPort {
  abstract list(): Promise<StorageBinding[]>;
  abstract findByName(name: string): Promise<StorageBinding | null>;
  /** Direct lookup by storage_bindings.id. */
  abstract findById(id: string): Promise<StorageBinding | null>;
}
