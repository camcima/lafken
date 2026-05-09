import type { UploadIntent } from "../entities/upload-intent.entity";

export interface IInsertUploadIntentInput {
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
}

export interface IFindOrphanedForSweepInput {
  now: Date;
  graceMs: number;
  limit: number;
}

export interface IRefreshUploadUrlInput {
  publicId: string;
  uploadUrl: string;
  uploadUrlExpiresAt: Date;
  now: Date;
}

export abstract class UploadIntentWriteRepositoryPort {
  abstract insert(input: IInsertUploadIntentInput): Promise<UploadIntent>;
  abstract findByPublicId(publicId: string): Promise<UploadIntent | null>;
  abstract markConsumed(publicId: string): Promise<void>;
  abstract findOrphanedForSweep(input: IFindOrphanedForSweepInput): Promise<UploadIntent[]>;
  abstract markExpired(publicId: string, now: Date): Promise<boolean>;
  abstract refreshUploadUrl(input: IRefreshUploadUrlInput): Promise<boolean>;
}
