export interface IGcsBindingDescriptor {
  bucket: string;
  projectId: string;
}

export interface IIssueSignedUploadUrlInput {
  binding: IGcsBindingDescriptor;
  storageKey: string;
  contentType: string;
  maxBytes: bigint;
  ttlSeconds: number;
}

export interface IIssueSignedUploadUrlResult {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface IObjectExistsInput {
  binding: IGcsBindingDescriptor;
  storageKey: string;
}

export interface IReadObjectBytesInput {
  binding: IGcsBindingDescriptor;
  storageKey: string;
  /**
   * Optional cap on bytes returned. When set, the adapter MUST issue a
   * `Range: bytes=0-(maxBytes-1)` request so we don't pull the full object
   * across the wire just to inspect a prefix (e.g., for magic-byte sniffing
   * during confirm).
   */
  maxBytes?: number;
}

export interface ISignReadUrlInput {
  binding: IGcsBindingDescriptor;
  storageKey: string;
  ttlSeconds: number;
}

export interface IMoveObjectInput {
  binding: IGcsBindingDescriptor;
  fromKey: string;
  toKey: string;
}

export abstract class AssetStoragePort {
  abstract issueSignedUploadUrl(
    input: IIssueSignedUploadUrlInput,
  ): Promise<IIssueSignedUploadUrlResult>;
  abstract objectExists(input: IObjectExistsInput): Promise<boolean>;
  abstract readObjectBytes(input: IReadObjectBytesInput): Promise<Buffer>;
  /**
   * Signs a read URL targeted at consumers on the same network as the backend
   * (typically the user's browser fetching a download URL). The signed host
   * matches the backend's view of the storage service.
   */
  abstract signReadUrl(input: ISignReadUrlInput): Promise<string>;
  /**
   * Signs a read URL targeted at the imgproxy renderer, which may resolve
   * the storage service through a different hostname than the backend
   * (e.g. fake-gcs's container DNS in dev). The signed host matches the
   * renderer's view of the storage service.
   */
  abstract signSourceUrlForRendering(input: ISignReadUrlInput): Promise<string>;
  /**
   * Relocates an object within the binding (copy + delete). MUST be idempotent:
   * if `fromKey` is gone but `toKey` already exists, treat as success — this
   * lets callers safely retry after a partial failure (e.g., DB transition
   * failed after the move succeeded). Throws iff neither key is present, or
   * the underlying storage rejects the operation for other reasons.
   */
  abstract moveObject(input: IMoveObjectInput): Promise<void>;
}
