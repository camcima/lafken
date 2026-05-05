import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { StorageBindingWriteRepositoryPort } from "@/system/domain/repositories/storage-binding-write.repository.port";

let nextIdCounter = 1;
const UUID_SUFFIX_PAD_LENGTH = 12;

function generateFakeUuid(): string {
  const counter = nextIdCounter++;
  return `01900000-0000-7000-8000-${String(counter).padStart(UUID_SUFFIX_PAD_LENGTH, "0")}`;
}

export class InMemoryStorageBindingWriteRepository implements StorageBindingWriteRepositoryPort {
  private readonly bindings = new Map<string, StorageBinding>();

  insert(binding: StorageBinding): Promise<StorageBinding> {
    const stored = StorageBinding.fromProps({
      ...binding.props,
      id: generateFakeUuid(),
    });
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
