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
   * Optional cap on bytes returned. Omitted/`undefined` means "read the
   * whole object" (current behavior, both implementations agree). When
   * provided, it MUST be a positive integer (`>= 1`); the adapter MUST issue
   * a `Range: bytes=0-(maxBytes-1)` request so we don't pull the full object
   * across the wire just to inspect a prefix (e.g., for magic-byte sniffing
   * during confirm).
   *
   * A value `<= 0` or non-integer is a programming error, not a valid
   * "read nothing"/"unlimited" request: every implementation MUST throw via
   * {@link assertValidMaxBytes} rather than fail open (returning the whole
   * object, e.g. because `0` is falsy) or silently returning an empty
   * buffer. Callers must never pass `0`/negative/non-integer values.
   */
  maxBytes?: number;
}

/**
 * Shared precondition for every `readObjectBytes` implementation, so the
 * fake and the real GCS adapter can't drift on how they treat the `maxBytes`
 * edge (see {@link IReadObjectBytesInput.maxBytes}). Throws a plain `Error`
 * — this is an invalid-argument/programming error, not a business rule
 * violation or user input problem, so it deliberately isn't a `DomainError`
 * or `ValidationError`.
 */
export function assertValidMaxBytes(maxBytes: number | undefined): void {
  if (maxBytes === undefined) return;
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new Error(
      `readObjectBytes: maxBytes must be a positive integer when provided, got ${String(maxBytes)}.`,
    );
  }
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

export interface IDeleteObjectInput {
  binding: IGcsBindingDescriptor;
  storageKey: string;
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
  /**
   * Deletes an object from storage. Best-effort — callers MUST NOT rely on
   * this succeeding. Implementations should use `ignoreNotFound: true` so a
   * missing object is treated as a no-op rather than an error.
   */
  abstract deleteObject(input: IDeleteObjectInput): Promise<void>;
}
