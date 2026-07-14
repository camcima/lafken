import type { GcsBindingConfig } from "../entities/storage-binding.entity";

export abstract class BucketExistsCheckerPort {
  abstract checkBucketExists(props: {
    adapterType: "gcs";
    config: GcsBindingConfig;
  }): Promise<void>;
}
