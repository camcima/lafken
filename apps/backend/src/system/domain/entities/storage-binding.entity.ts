import {
  GcsBindingConfig,
  gcsBindingConfigSchema,
} from "@/system/domain/schemas/gcs-binding-config.schema";

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

  getGcsConfig(): GcsBindingConfig {
    if (this.props.adapterType !== "gcs") {
      throw new Error(
        `StorageBinding.getGcsConfig() called on a non-GCS binding — invariant violation.`,
      );
    }
    return gcsBindingConfigSchema.parse(this.props.config);
  }
}
