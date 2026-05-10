import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { FileSizeExceedsPolicyError } from "@/assets/domain/errors/file-size-exceeds-policy.error";
import { MimeTypeNotAllowedError } from "@/assets/domain/errors/mime-type-not-allowed.error";
import { UploadIntentWriteRepositoryPort } from "@/assets/domain/repositories/upload-intent-write.repository.port";
import {
  type UploadProtocol,
  UploadUrlIssuerPort,
} from "@/assets/domain/services/upload-url-issuer.service.port";
import { NamespaceArchivedError } from "@/namespaces/domain/errors/namespace-archived.error";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import { MetricsPort } from "@/shared/application/metrics.port";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

const UPLOAD_URL_TTL_SECONDS = 900;

export interface ICreateUploadIntentInput {
  namespaceSlug: string;
  declaredMimeType: string;
  declaredSizeBytes: bigint;
  createdBy: string | null;
  protocol?: UploadProtocol;
}

export interface ICreateUploadIntentResult {
  publicId: string;
  protocol: UploadProtocol;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  expiresAt: Date;
}

@Injectable()
export class CreateUploadIntentUseCase {
  constructor(
    private readonly namespaceQueryRepository: NamespaceQueryRepositoryPort,
    private readonly storageBindingQueryRepository: StorageBindingQueryRepositoryPort,
    private readonly uploadIntentWriteRepository: UploadIntentWriteRepositoryPort,
    private readonly uploadUrlIssuer: UploadUrlIssuerPort,
    private readonly metrics: MetricsPort,
  ) {}

  async execute(input: ICreateUploadIntentInput): Promise<ICreateUploadIntentResult> {
    const namespace = await this.namespaceQueryRepository.findBySlug(input.namespaceSlug);
    if (!namespace) {
      throw new NamespaceNotFoundError({ slug: input.namespaceSlug });
    }
    if (namespace.props.archivedAt !== null) {
      throw new NamespaceArchivedError({ slug: input.namespaceSlug });
    }

    const policy = await this.namespaceQueryRepository.findActivePolicy(namespace.props.id);
    if (!policy) {
      throw new Error(
        `Active policy not found for namespace "${input.namespaceSlug}" — invariant violation.`,
      );
    }

    if (!policy.props.allowedMimeTypes.includes(input.declaredMimeType)) {
      throw new MimeTypeNotAllowedError({
        namespaceSlug: input.namespaceSlug,
        declaredMimeType: input.declaredMimeType,
        allowedMimeTypes: policy.props.allowedMimeTypes,
      });
    }
    if (input.declaredSizeBytes > policy.props.maxFileSizeBytes) {
      throw new FileSizeExceedsPolicyError({
        namespaceSlug: input.namespaceSlug,
        declaredSizeBytes: input.declaredSizeBytes,
        maxFileSizeBytes: policy.props.maxFileSizeBytes,
      });
    }

    const binding = await this.storageBindingQueryRepository.findById(
      namespace.props.storageBindingId,
    );
    if (!binding) {
      throw new Error(
        `Storage binding "${namespace.props.storageBindingId}" missing for namespace "${input.namespaceSlug}".`,
      );
    }

    const gcsConfig = binding.getGcsConfig();
    const publicId = randomUUID();
    const storageKey = `${input.namespaceSlug}/assets/${publicId}/source`;
    const protocol: UploadProtocol = input.protocol ?? "simple";
    const issued = await this.uploadUrlIssuer.issue({
      protocol,
      binding: { bucket: gcsConfig.bucket, projectId: gcsConfig.projectId },
      storageKey,
      contentType: input.declaredMimeType,
      maxBytes: policy.props.maxFileSizeBytes,
      ttlSeconds: UPLOAD_URL_TTL_SECONDS,
    });

    await this.uploadIntentWriteRepository.insert({
      publicId,
      namespaceId: namespace.props.id,
      policyVersionId: policy.props.id,
      storageBindingId: binding.props.id,
      storageKey,
      declaredMimeType: input.declaredMimeType,
      declaredSizeBytes: input.declaredSizeBytes,
      uploadUrl: issued.uploadUrl,
      uploadUrlExpiresAt: issued.expiresAt,
      createdBy: input.createdBy,
    });

    this.metrics.recordUploadIntentCreated({
      namespaceSlug: input.namespaceSlug,
      protocol: issued.protocol,
    });

    return {
      publicId,
      protocol: issued.protocol,
      uploadUrl: issued.uploadUrl,
      uploadHeaders: issued.uploadHeaders,
      expiresAt: issued.expiresAt,
    };
  }
}
