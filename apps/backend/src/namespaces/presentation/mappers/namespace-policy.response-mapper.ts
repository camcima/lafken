import { NamespacePolicyResponseDTO } from "@shared/backend-api";

import { NamespacePolicy } from "@/namespaces/domain/entities/namespace-policy.entity";

export class NamespacePolicyResponseMapper {
  static fromDomain(policy: NamespacePolicy): NamespacePolicyResponseDTO {
    return {
      version: policy.props.version,
      retentionDays: policy.props.retentionDays ?? undefined,
      retentionMode: policy.props.retentionMode,
      maxFileSizeBytes: Number(policy.props.maxFileSizeBytes),
      allowedMimeTypes: policy.props.allowedMimeTypes,
      virusScanRequired: policy.props.virusScanRequired,
      contentModeration: policy.props.contentModeration ?? undefined,
      requiredMetadataSchema: policy.props.requiredMetadataSchema ?? undefined,
      immutable: policy.props.immutable,
      servingMode: policy.props.servingMode,
      signedUrlTtlSeconds: policy.props.signedUrlTtlSeconds ?? undefined,
      signedUrlBucketSize: policy.props.signedUrlBucketSize ?? undefined,
      retryConfig: policy.props.retryConfig ?? undefined,
      createdBy: policy.props.createdBy ?? undefined,
      createdAt: policy.props.createdAt.toISOString(),
    };
  }
}
