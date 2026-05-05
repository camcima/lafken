export type RetentionMode = "delete" | "archive" | "none";
export type EXIFHandling = "strip" | "preserve" | "extract_then_strip";
export type ServingMode = "public" | "signed" | "proxied";

export interface INamespacePolicyProps {
  id: string;
  namespaceId: string;
  version: number;
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
  createdBy: string | null;
  createdAt: Date;
}

export class NamespacePolicy {
  constructor(public readonly props: INamespacePolicyProps) {}

  static fromProps(props: INamespacePolicyProps): NamespacePolicy {
    return new NamespacePolicy(props);
  }
}
