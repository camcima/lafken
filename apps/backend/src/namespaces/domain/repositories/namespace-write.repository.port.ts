import type { EXIFHandling, RetentionMode, ServingMode } from "../entities/namespace-policy.entity";
import type { Namespace } from "../entities/namespace.entity";

export interface ICreateNamespaceInput {
  slug: string;
  displayName: string;
  description: string | null;
  storageBindingId: bigint;
  policy: ICreateNamespaceInitialPolicyInput;
  createdBy: string | null;
}

export interface ICreateNamespaceInitialPolicyInput {
  retentionDays: number | null;
  retentionMode: RetentionMode;
  maxFileSizeBytes: bigint;
  allowedMimeTypes: string[];
  exifHandling: EXIFHandling;
  virusScanRequired: boolean;
  contentModeration: Record<string, unknown> | null;
  requiredMetadataSchema: Record<string, unknown> | null;
  immutable: boolean;
  servingMode: ServingMode;
  signedUrlTtlSeconds: number | null;
  signedUrlBucketSize: number | null;
  retryConfig: Record<string, unknown> | null;
}

export interface IUpdateNamespaceMetadataInput {
  slug: string;
  displayName: string;
  description: string | null;
}

export abstract class NamespaceWriteRepositoryPort {
  abstract createWithInitialPolicy(input: ICreateNamespaceInput): Promise<Namespace>;
  abstract updateMetadata(input: IUpdateNamespaceMetadataInput): Promise<Namespace>;
  abstract archive(slug: string): Promise<Namespace>;
  abstract unarchive(slug: string): Promise<Namespace>;
}
