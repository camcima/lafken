import { type Bucket, Storage, type StorageOptions } from "@google-cloud/storage";
import { Injectable } from "@nestjs/common";

import {
  AssetStoragePort,
  type IGcsBindingDescriptor,
  type IIssueSignedUploadUrlInput,
  type IIssueSignedUploadUrlResult,
  type IObjectExistsInput,
  type IReadObjectBytesInput,
  type ISignReadUrlInput,
} from "@/assets/domain/services/asset-storage.service.port";

const FAKE_GCS_PROJECT_ID = "fake-gcs";
const MS_PER_SECOND = 1000;

interface IGcsAssetStorageOptions {
  /** Endpoint the backend uses for its own GCS API calls and for signing
   *  upload/download URLs that the user's browser fetches. */
  endpoint?: string;
  /** Endpoint to sign preview-source URLs against. The renderer (imgproxy)
   *  may resolve GCS through different DNS than the backend (e.g. fake-gcs
   *  via container DNS in dev). Defaults to {@link endpoint}. */
  previewSourceEndpoint?: string;
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
  /**
   * Separate Storage client used solely to sign preview-source URLs against
   * the renderer-side hostname. Falls back to {@link storage} when the
   * preview endpoint matches the API endpoint (the prod-default case).
   */
  private readonly previewStorage: Storage;

  constructor(options: IGcsAssetStorageOptions) {
    super();
    const credentials: IServiceAccountCredentials | undefined = options.credentialsJson
      ? (JSON.parse(options.credentialsJson) as IServiceAccountCredentials)
      : undefined;

    this.storage = buildStorageClient({
      endpoint: options.endpoint,
      credentials,
    });

    const previewEndpointOverride: string | undefined =
      options.previewSourceEndpoint && options.previewSourceEndpoint !== options.endpoint
        ? options.previewSourceEndpoint
        : undefined;
    this.previewStorage = previewEndpointOverride
      ? buildStorageClient({ endpoint: previewEndpointOverride, credentials })
      : this.storage;
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

  async signReadUrl(input: ISignReadUrlInput): Promise<string> {
    const expiresAt = new Date(Date.now() + input.ttlSeconds * MS_PER_SECOND);
    const [url] = await this.getBucket(input.binding).file(input.storageKey).getSignedUrl({
      action: "read",
      version: "v4",
      expires: expiresAt,
    });
    return url;
  }

  async signSourceUrlForRendering(input: ISignReadUrlInput): Promise<string> {
    const expiresAt = new Date(Date.now() + input.ttlSeconds * MS_PER_SECOND);
    const [url] = await this.getPreviewBucket(input.binding).file(input.storageKey).getSignedUrl({
      action: "read",
      version: "v4",
      expires: expiresAt,
    });
    return url;
  }

  private getBucket(binding: IGcsBindingDescriptor): Bucket {
    return this.storage.bucket(binding.bucket, { userProject: binding.projectId });
  }

  private getPreviewBucket(binding: IGcsBindingDescriptor): Bucket {
    return this.previewStorage.bucket(binding.bucket, { userProject: binding.projectId });
  }
}

function buildStorageClient(options: {
  endpoint?: string;
  credentials: IServiceAccountCredentials | undefined;
}): Storage {
  const storageOptions: StorageOptions = {
    projectId: options.credentials?.project_id ?? FAKE_GCS_PROJECT_ID,
    retryOptions: { autoRetry: false, maxRetries: 0 },
  };
  if (options.endpoint) {
    // Setting apiEndpoint causes the SDK to derive customEndpoint=true
    // internally, which skips ADC / metadata-server token acquisition —
    // exactly what fake-gcs-server needs (no auth required).
    storageOptions.apiEndpoint = options.endpoint;
  }
  if (options.credentials?.client_email && options.credentials.private_key) {
    storageOptions.credentials = {
      client_email: options.credentials.client_email,
      private_key: options.credentials.private_key,
    };
  }
  return new Storage(storageOptions);
}
