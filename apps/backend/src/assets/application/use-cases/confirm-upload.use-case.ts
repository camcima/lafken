import { Injectable } from "@nestjs/common";

import type { AssetWithMetadata } from "@/assets/application/use-cases/list-assets.use-case";
import type { Asset } from "@/assets/domain/entities/asset.entity";
import { UploadIntentConsumeConflictError } from "@/assets/domain/errors/upload-intent-consume-conflict.error";
import { UploadIntentExpiredError } from "@/assets/domain/errors/upload-intent-expired.error";
import { UploadIntentNotFoundError } from "@/assets/domain/errors/upload-intent-not-found.error";
import { UploadedObjectMissingError } from "@/assets/domain/errors/uploaded-object-missing.error";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { AssetWriteRepositoryPort } from "@/assets/domain/repositories/asset-write.repository.port";
import { UploadIntentWriteRepositoryPort } from "@/assets/domain/repositories/upload-intent-write.repository.port";
import { AssetStoragePort } from "@/assets/domain/services/asset-storage.service.port";
import { AuditWriteRepositoryPort } from "@/audit/domain/repositories/audit-write.repository.port";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import { MetricsPort } from "@/shared/application/metrics.port";
import { UnitOfWorkPort } from "@/shared/application/unit-of-work.port";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;
const AUDIT_FALLBACK_PRINCIPAL = "system";
const UNKNOWN_NAMESPACE_SLUG = "unknown";
const UNKNOWN_POLICY_VERSION = 0;

export interface IConfirmUploadInput {
  publicId: string;
  uploadedBy: string | null;
  width?: number;
  height?: number;
  externalRefType?: string;
  externalRefId?: string;
  /** Free-text uploader note — persisted under `custom_metadata.note`. */
  note?: string;
  tags?: string[];
  requestIp: string | null;
}

@Injectable()
export class ConfirmUploadUseCase {
  constructor(
    private readonly intentRepo: UploadIntentWriteRepositoryPort,
    private readonly assetWriteRepo: AssetWriteRepositoryPort,
    private readonly assetStorage: AssetStoragePort,
    private readonly namespaceQueryRepo: NamespaceQueryRepositoryPort,
    private readonly storageBindingQueryRepo: StorageBindingQueryRepositoryPort,
    private readonly assetQueryRepo: AssetQueryRepositoryPort,
    private readonly auditWriteRepo: AuditWriteRepositoryPort,
    private readonly metrics: MetricsPort,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(input: IConfirmUploadInput): Promise<AssetWithMetadata> {
    const intent = await this.intentRepo.findByPublicId(input.publicId);
    if (!intent) {
      throw new UploadIntentNotFoundError({ publicId: input.publicId });
    }

    if (intent.isConsumed()) {
      const existing = await this.assetQueryRepo.findByPublicId(input.publicId);
      if (!existing) {
        throw new Error(
          `Intent "${input.publicId}" is consumed but no asset exists — invariant violation.`,
        );
      }
      return this.composeMetadata(existing);
    }

    const now = new Date();
    if (intent.isExpired(now)) {
      throw new UploadIntentExpiredError({
        publicId: input.publicId,
        expiredAt: intent.props.uploadUrlExpiresAt,
      });
    }

    const binding = await this.storageBindingQueryRepo.findById(intent.props.storageBindingId);
    if (!binding) {
      throw new Error(
        `Storage binding "${intent.props.storageBindingId}" missing for intent "${input.publicId}".`,
      );
    }

    const gcsConfig = binding.getGcsConfig();
    const exists = await this.assetStorage.objectExists({
      binding: { bucket: gcsConfig.bucket, projectId: gcsConfig.projectId },
      storageKey: intent.props.storageKey,
    });
    if (!exists) {
      throw new UploadedObjectMissingError({
        publicId: input.publicId,
        storageKey: intent.props.storageKey,
      });
    }

    const policy = await this.namespaceQueryRepo.findPolicyById(intent.props.policyVersionId);
    if (!policy) {
      throw new Error(
        `Policy version "${intent.props.policyVersionId}" missing for intent "${input.publicId}".`,
      );
    }

    // Resolve the namespace slug before entering the UoW block so the read
    // runs on the default connection (the namespace already exists).
    const namespaceSlug =
      (await this.assetQueryRepo.findNamespaceSlug(intent.props.namespaceId)) ?? null;

    let asset: Asset;
    try {
      asset = await this.unitOfWork.execute(async () => {
        const created: Asset = await this.assetWriteRepo.createUploadedAsset({
          publicId: intent.props.publicId,
          namespaceId: intent.props.namespaceId,
          policyVersionId: intent.props.policyVersionId,
          storageBindingId: intent.props.storageBindingId,
          storageKey: intent.props.storageKey,
          declaredMimeType: intent.props.declaredMimeType,
          declaredSizeBytes: intent.props.declaredSizeBytes,
          uploadedBy: input.uploadedBy,
          effectiveMaxSizeBytes: policy.props.maxFileSizeBytes,
          effectiveUrlTtl: policy.props.signedUrlTtlSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS,
          intentId: intent.props.id,
          width: input.width ?? null,
          height: input.height ?? null,
          externalRefType: input.externalRefType ?? null,
          externalRefId: input.externalRefId ?? null,
          tags: input.tags,
          customMetadata: input.note !== undefined ? { note: input.note } : undefined,
        });

        await this.auditWriteRepo.record({
          entityType: "asset",
          entityId: created.props.publicId,
          action: "create",
          occurredBy: input.uploadedBy ?? AUDIT_FALLBACK_PRINCIPAL,
          requestIp: input.requestIp,
          afterState: {
            namespace: namespaceSlug,
            storageKey: created.props.storageKey,
            declaredMimeType: created.props.declaredMimeType,
            sizeBytes: created.props.sizeBytes !== null ? String(created.props.sizeBytes) : null,
          },
        });

        return created;
      });
    } catch (err) {
      if (err instanceof UploadIntentConsumeConflictError) {
        // F-P8: a concurrent confirm won the consume race (its transaction
        // committed the asset), or the sweeper expired the intent. Fall back
        // to the idempotent already-consumed lookup instead of surfacing a
        // unique-constraint 500.
        const existing = await this.assetQueryRepo.findByPublicId(input.publicId);
        if (existing) {
          return this.composeMetadata(existing);
        }
        const freshIntent = await this.intentRepo.findByPublicId(input.publicId);
        if (freshIntent?.props.expiredAt) {
          throw new UploadIntentExpiredError({
            publicId: input.publicId,
            expiredAt: freshIntent.props.expiredAt,
          });
        }
        // Winner's transaction not yet visible — rethrow (422); the client's
        // retry lands on the idempotent already-consumed path.
        throw err;
      }
      throw err;
    }

    if (namespaceSlug !== null) {
      this.metrics.recordUploadConfirmed({
        namespaceSlug,
        state: asset.props.state,
      });
    }

    return {
      asset,
      namespaceSlug: namespaceSlug ?? UNKNOWN_NAMESPACE_SLUG,
      policyVersion: policy.props.version,
    };
  }

  /**
   * Re-resolves display metadata for the idempotent path, where the policy
   * and slug weren't loaded as part of a fresh confirm.
   */
  private async composeMetadata(asset: Asset): Promise<AssetWithMetadata> {
    const [namespaceSlug, policyVersion] = await Promise.all([
      this.assetQueryRepo.findNamespaceSlug(asset.props.namespaceId),
      this.assetQueryRepo.findPolicyVersion(asset.props.policyVersionId),
    ]);
    return {
      asset,
      namespaceSlug: namespaceSlug ?? UNKNOWN_NAMESPACE_SLUG,
      policyVersion: policyVersion ?? UNKNOWN_POLICY_VERSION,
    };
  }
}
