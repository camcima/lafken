import { type Bucket, Storage, type StorageOptions } from "@google-cloud/storage";
import { Injectable } from "@nestjs/common";

import {
  AssetStoragePort,
  type IGcsBindingDescriptor,
  type IIssueSignedUploadUrlInput,
  type IIssueSignedUploadUrlResult,
  type IMoveObjectInput,
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
   * Origin (`scheme://host[:port]`) the backend rewrites onto preview-source
   * URLs after signing, so imgproxy can resolve them through compose DNS
   * (e.g. `http://fake-gcs:4443`) while the URL is fetched via the JSON
   * download API (which doesn't validate signatures). Undefined in prod,
   * where signing endpoint and renderer endpoint coincide.
   */
  private readonly previewSourceOrigin?: string;

  constructor(options: IGcsAssetStorageOptions) {
    super();
    const credentials: IServiceAccountCredentials | undefined = options.credentialsJson
      ? (JSON.parse(options.credentialsJson) as IServiceAccountCredentials)
      : undefined;

    this.storage = buildStorageClient({
      endpoint: options.endpoint,
      credentials,
    });

    this.previewSourceOrigin =
      options.previewSourceEndpoint && options.previewSourceEndpoint !== options.endpoint
        ? options.previewSourceEndpoint
        : undefined;
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
    const downloadOptions = input.maxBytes ? { start: 0, end: input.maxBytes - 1 } : undefined;
    const [bytes] = await this.getBucket(input.binding)
      .file(input.storageKey)
      .download(downloadOptions);
    return bytes;
  }

  async moveObject(input: IMoveObjectInput): Promise<void> {
    if (input.fromKey === input.toKey) return;
    const bucket = this.getBucket(input.binding);
    const source = bucket.file(input.fromKey);
    const target = bucket.file(input.toKey);
    const [sourceExists] = await source.exists();
    if (!sourceExists) {
      // Idempotency: a previous attempt may have moved the bytes successfully
      // before its caller's DB write completed. If the target is in place,
      // treat as already-done; otherwise the asset is genuinely gone.
      const [targetExists] = await target.exists();
      if (targetExists) return;
      throw new Error(
        `moveObject: neither "${input.fromKey}" nor "${input.toKey}" exists in bucket "${input.binding.bucket}".`,
      );
    }
    await source.copy(target);
    await source.delete({ ignoreNotFound: true });
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
    if (this.previewSourceOrigin) {
      // Dev path: fake-gcs reaches imgproxy through compose DNS at a different
      // host than the browser uses. fake-gcs interprets unfamiliar Host headers
      // as virtual-hosted bucket names, so a V4-signed path-style URL signed
      // for one host (and fetched at another) gets routed to a non-existent
      // bucket. The JSON download API serves objects on any host without
      // signature validation, which is fine in a dev sandbox.
      const encodedKey: string = encodeURIComponent(input.storageKey);
      return (
        `${this.previewSourceOrigin}/storage/v1/b/${input.binding.bucket}` +
        `/o/${encodedKey}?alt=media`
      );
    }
    return this.signReadUrl(input);
  }

  private getBucket(binding: IGcsBindingDescriptor): Bucket {
    return this.storage.bucket(binding.bucket, { userProject: binding.projectId });
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
