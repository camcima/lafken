import { Storage, type StorageOptions } from "@google-cloud/storage";
import { Injectable } from "@nestjs/common";

import { BucketCheckFailedError } from "@/system/domain/errors/bucket-check-failed.error";
import { BucketNotFoundError } from "@/system/domain/errors/bucket-not-found.error";
import type { GcsBindingConfig } from "@/system/domain/schemas/gcs-binding-config.schema";
import { BucketExistsCheckerPort } from "@/system/domain/services/bucket-exists-checker.service.port";

interface IGcsBucketExistsCheckerOptions {
  endpoint?: string;
  credentialsJson?: string;
}

interface IServiceAccountCredentials {
  client_email?: string;
  private_key?: string;
  project_id?: string;
}

@Injectable()
export class GcsBucketExistsCheckerAdapter extends BucketExistsCheckerPort {
  private readonly storage: Storage;

  constructor(options: IGcsBucketExistsCheckerOptions) {
    super();
    const credentials: IServiceAccountCredentials | undefined = options.credentialsJson
      ? (JSON.parse(options.credentialsJson) as IServiceAccountCredentials)
      : undefined;

    const storageOptions: StorageOptions = {
      projectId: credentials?.project_id ?? "lafken-dev",
      // Existence checks are quick yes/no probes — surface failures fast
      // instead of letting the SDK retry-loop for the default 600 seconds.
      retryOptions: { autoRetry: false, maxRetries: 0 },
    };

    if (options.endpoint) {
      // Setting apiEndpoint causes the SDK to derive customEndpoint=true
      // internally, which skips ADC / metadata-server token acquisition —
      // exactly what fake-gcs-server needs (no auth required).
      storageOptions.apiEndpoint = options.endpoint;
    }

    if (credentials?.client_email && credentials.private_key) {
      storageOptions.credentials = {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      };
    }

    this.storage = new Storage(storageOptions);
  }

  async checkBucketExists(props: { adapterType: "gcs"; config: GcsBindingConfig }): Promise<void> {
    const bucketName: string = props.config.bucket;
    let exists: boolean;
    try {
      [exists] = await this.storage.bucket(bucketName).exists();
    } catch (err) {
      throw new BucketCheckFailedError({
        adapterType: "gcs",
        bucket: bucketName,
        cause: err instanceof Error ? err.message : String(err),
      });
    }
    if (!exists) {
      throw new BucketNotFoundError({ adapterType: "gcs", bucket: bucketName });
    }
  }
}
