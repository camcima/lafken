import type { IGcsBindingDescriptor } from "@/assets/domain/services/asset-storage.service.port";

export type UploadProtocol = "simple" | "tus";

export interface IIssueUploadUrlInput {
  protocol: UploadProtocol;
  binding: IGcsBindingDescriptor;
  storageKey: string;
  contentType: string;
  maxBytes: bigint;
  ttlSeconds: number;
}

export interface IIssueUploadUrlResult {
  protocol: UploadProtocol;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  expiresAt: Date;
}

export abstract class UploadUrlIssuerPort {
  abstract issue(input: IIssueUploadUrlInput): Promise<IIssueUploadUrlResult>;
}
