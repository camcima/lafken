import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

export class InMemoryStorageBindingQueryRepository implements StorageBindingQueryRepositoryPort {
  private bindings: StorageBinding[] = [];

  seed(bindings: StorageBinding[]): void {
    this.bindings = bindings;
  }

  list(): Promise<StorageBinding[]> {
    return Promise.resolve([...this.bindings]);
  }

  findByName(name: string): Promise<StorageBinding | null> {
    return Promise.resolve(this.bindings.find((b) => b.props.name === name) ?? null);
  }

  findById(id: string): Promise<StorageBinding | null> {
    return Promise.resolve(this.bindings.find((b) => b.props.id === id) ?? null);
  }
}
