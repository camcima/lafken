export interface IUploadIntentProps {
  id: string;
  publicId: string;
  namespaceId: string;
  policyVersionId: string;
  storageBindingId: string;
  storageKey: string;
  declaredMimeType: string;
  declaredSizeBytes: bigint;
  uploadUrl: string;
  uploadUrlExpiresAt: Date;
  createdBy: string | null;
  consumedAt: Date | null;
  expiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class UploadIntent {
  constructor(public readonly props: IUploadIntentProps) {}

  static fromProps(props: IUploadIntentProps): UploadIntent {
    return new UploadIntent(props);
  }

  isConsumed(): boolean {
    return this.props.consumedAt !== null;
  }

  isExpired(now: Date): boolean {
    return now.getTime() >= this.props.uploadUrlExpiresAt.getTime();
  }
}
