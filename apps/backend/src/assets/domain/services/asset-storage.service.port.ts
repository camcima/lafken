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

export abstract class AssetStoragePort {
  abstract issueSignedUploadUrl(
    input: IIssueSignedUploadUrlInput,
  ): Promise<IIssueSignedUploadUrlResult>;
  abstract objectExists(input: IObjectExistsInput): Promise<boolean>;
  abstract readObjectBytes(input: IReadObjectBytesInput): Promise<Buffer>;
}
