import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { StorageBindingWriteRepositoryPort } from "@/system/domain/repositories/storage-binding-write.repository.port";

const INITIAL_ID = 1n;
const ID_INCREMENT = 1n;

export class InMemoryStorageBindingWriteRepository implements StorageBindingWriteRepositoryPort {
  private readonly bindings = new Map<string, StorageBinding>();
  private nextId: bigint = INITIAL_ID;

  insert(binding: StorageBinding): Promise<StorageBinding> {
    const stored = StorageBinding.fromProps({
      ...binding.props,
      id: this.nextId,
    });
    this.nextId += ID_INCREMENT;
    this.bindings.set(stored.props.name, stored);
    return Promise.resolve(stored);
  }

  update(binding: StorageBinding): Promise<StorageBinding> {
    this.bindings.set(binding.props.name, binding);
    return Promise.resolve(binding);
  }

  delete(name: string): Promise<void> {
    this.bindings.delete(name);
    return Promise.resolve();
  }

  // Test-only helpers
  seed(binding: StorageBinding): void {
    this.bindings.set(binding.props.name, binding);
    if (binding.props.id >= this.nextId) {
      this.nextId = binding.props.id + ID_INCREMENT;
    }
  }

  has(name: string): boolean {
    return this.bindings.has(name);
  }

  get(name: string): StorageBinding | undefined {
    return this.bindings.get(name);
  }

  size(): number {
    return this.bindings.size;
  }
}
