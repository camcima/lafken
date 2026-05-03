export interface IStorageBindingProps {
  id: bigint;
  name: string;
  adapterType: "gcs" | "s3" | "local";
  config: Record<string, unknown>;
  encryptedCreds: Buffer | null;
  createdAt: Date;
  updatedAt: Date;
}

export class StorageBinding {
  constructor(public readonly props: IStorageBindingProps) {}

  static fromProps(props: IStorageBindingProps): StorageBinding {
    return new StorageBinding(props);
  }
}
