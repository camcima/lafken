export interface IStorageBindingProps {
  id: string;
  name: string;
  adapterType: "gcs";
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class StorageBinding {
  constructor(public readonly props: IStorageBindingProps) {}

  static fromProps(props: IStorageBindingProps): StorageBinding {
    return new StorageBinding(props);
  }
}
