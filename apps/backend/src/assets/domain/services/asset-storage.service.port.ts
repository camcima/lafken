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
}

export interface ISignReadUrlInput {
  binding: IGcsBindingDescriptor;
  storageKey: string;
  ttlSeconds: number;
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
}
