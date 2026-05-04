import { InvalidStorageBindingNameError } from "../errors/invalid-storage-binding-name.error";

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export class StorageBindingName {
  private constructor(public readonly value: string) {}

  static fromString(value: string): StorageBindingName {
    if (!NAME_PATTERN.test(value)) {
      throw new InvalidStorageBindingNameError(value);
    }
    return new StorageBindingName(value);
  }
}
