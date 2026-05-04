import type { GcsBindingConfig } from "../schemas/gcs-binding-config.schema";

export abstract class BucketExistsCheckerPort {
  abstract checkBucketExists(props: {
    adapterType: "gcs";
    config: GcsBindingConfig;
  }): Promise<void>;
}
