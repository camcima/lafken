import type { GcsBindingConfig } from "@/system/domain/entities/storage-binding.entity";
import { BucketNotFoundError } from "@/system/domain/errors/bucket-not-found.error";
import { BucketExistsCheckerPort } from "@/system/domain/services/bucket-exists-checker.service.port";

export class InMemoryBucketExistsChecker implements BucketExistsCheckerPort {
  public readonly existingBuckets = new Set<string>();

  checkBucketExists(props: { adapterType: "gcs"; config: GcsBindingConfig }): Promise<void> {
    if (!this.existingBuckets.has(props.config.bucket)) {
      return Promise.reject(
        new BucketNotFoundError({
          adapterType: props.adapterType,
          bucket: props.config.bucket,
        }),
      );
    }
    return Promise.resolve();
  }
}
