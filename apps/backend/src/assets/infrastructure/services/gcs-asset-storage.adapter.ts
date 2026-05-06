import { type Bucket, Storage, type StorageOptions } from "@google-cloud/storage";
import { Injectable } from "@nestjs/common";

import {
  AssetStoragePort,
  type IGcsBindingDescriptor,
  type IIssueSignedUploadUrlInput,
  type IIssueSignedUploadUrlResult,
  type IObjectExistsInput,
  type IReadObjectBytesInput,
} from "@/assets/domain/services/asset-storage.service.port";

const FAKE_GCS_PROJECT_ID = "fake-gcs";
const MS_PER_SECOND = 1000;

interface IGcsAssetStorageOptions {
  endpoint?: string;
  credentialsJson?: string;
}

interface IServiceAccountCredentials {
  client_email?: string;
  private_key?: string;
  project_id?: string;
}

@Injectable()
export class GcsAssetStorageAdapter extends AssetStoragePort {
  private readonly storage: Storage;

  constructor(options: IGcsAssetStorageOptions) {
    super();
    const credentials: IServiceAccountCredentials | undefined = options.credentialsJson
      ? (JSON.parse(options.credentialsJson) as IServiceAccountCredentials)
      : undefined;

    const storageOptions: StorageOptions = {
      projectId: credentials?.project_id ?? FAKE_GCS_PROJECT_ID,
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

  async issueSignedUploadUrl(
    input: IIssueSignedUploadUrlInput,
  ): Promise<IIssueSignedUploadUrlResult> {
    const expiresAt = new Date(Date.now() + input.ttlSeconds * MS_PER_SECOND);
    const [url] = await this.getBucket(input.binding)
      .file(input.storageKey)
      .getSignedUrl({
        action: "write",
        version: "v4",
        expires: expiresAt,
        contentType: input.contentType,
        extensionHeaders: {
          "x-goog-content-length-range": `0,${input.maxBytes.toString()}`,
        },
      });
    return {
      url,
      headers: {
        "Content-Type": input.contentType,
        "x-goog-content-length-range": `0,${input.maxBytes.toString()}`,
      },
      expiresAt,
    };
  }

  async objectExists(input: IObjectExistsInput): Promise<boolean> {
    const [exists] = await this.getBucket(input.binding).file(input.storageKey).exists();
    return exists;
  }

  async readObjectBytes(input: IReadObjectBytesInput): Promise<Buffer> {
    const [bytes] = await this.getBucket(input.binding).file(input.storageKey).download();
    return bytes;
  }

  private getBucket(binding: IGcsBindingDescriptor): Bucket {
    return this.storage.bucket(binding.bucket, { userProject: binding.projectId });
  }
}
