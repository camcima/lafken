import { Injectable } from "@nestjs/common";

import { UploadIntentAlreadyConsumedError } from "@/assets/domain/errors/upload-intent-already-consumed.error";
import { UploadIntentExpiredError } from "@/assets/domain/errors/upload-intent-expired.error";
import { UploadIntentNotFoundError } from "@/assets/domain/errors/upload-intent-not-found.error";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { UploadIntentWriteRepositoryPort } from "@/assets/domain/repositories/upload-intent-write.repository.port";
import {
  type UploadProtocol,
  UploadUrlIssuerPort,
} from "@/assets/domain/services/upload-url-issuer.service.port";
import { AuditWriteRepositoryPort } from "@/audit/domain/repositories/audit-write.repository.port";
import { uploadIntentRefreshedCounter } from "@/shared/infrastructure/telemetry/metrics";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

const REFRESH_URL_TTL_SECONDS = 900;

export interface IRefreshUploadUrlInput {
  publicId: string;
  /** When the original intent recorded a tus protocol, refresh issues a tus
   *  URL too; otherwise simple. The protocol is derived from the persisted
   *  intent so a stale client cannot escalate. */
  requestedBy: string;
}

export interface IRefreshUploadUrlResult {
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  expiresAt: Date;
  protocol: UploadProtocol;
}

@Injectable()
export class RefreshUploadUrlUseCase {
  constructor(
    private readonly intents: UploadIntentWriteRepositoryPort,
    private readonly bindings: StorageBindingQueryRepositoryPort,
    private readonly issuer: UploadUrlIssuerPort,
    private readonly auditWriteRepo: AuditWriteRepositoryPort,
    private readonly assetQueryRepo: AssetQueryRepositoryPort,
  ) {}

  async execute(input: IRefreshUploadUrlInput): Promise<IRefreshUploadUrlResult> {
    const intent = await this.intents.findByPublicId(input.publicId);
    if (!intent) {
      throw new UploadIntentNotFoundError({ publicId: input.publicId });
    }
    if (intent.props.consumedAt !== null) {
      throw new UploadIntentAlreadyConsumedError({
        publicId: input.publicId,
        consumedAt: intent.props.consumedAt,
      });
    }
    if (intent.props.expiredAt !== null) {
      throw new UploadIntentExpiredError({
        publicId: input.publicId,
        expiredAt: intent.props.expiredAt,
      });
    }

    const binding = await this.bindings.findById(intent.props.storageBindingId);
    if (!binding) {
      throw new Error(
        `Storage binding "${intent.props.storageBindingId}" missing for upload intent "${input.publicId}".`,
      );
    }
    const gcs = binding.getGcsConfig();
    const protocol: UploadProtocol = derivePersistedProtocol(intent.props.uploadUrl);
    const issued = await this.issuer.issue({
      protocol,
      binding: { bucket: gcs.bucket, projectId: gcs.projectId },
      storageKey: intent.props.storageKey,
      contentType: intent.props.declaredMimeType,
      maxBytes: intent.props.declaredSizeBytes,
      ttlSeconds: REFRESH_URL_TTL_SECONDS,
    });
    const now = new Date();
    const ok = await this.intents.refreshUploadUrl({
      publicId: input.publicId,
      uploadUrl: issued.uploadUrl,
      uploadUrlExpiresAt: issued.expiresAt,
      now,
    });
    if (!ok) {
      // Lost race with sweeper or confirm — re-read and surface the
      // appropriate error.
      const fresh = await this.intents.findByPublicId(input.publicId);
      if (fresh?.props.consumedAt) {
        throw new UploadIntentAlreadyConsumedError({
          publicId: input.publicId,
          consumedAt: fresh.props.consumedAt,
        });
      }
      if (fresh?.props.expiredAt) {
        throw new UploadIntentExpiredError({
          publicId: input.publicId,
          expiredAt: fresh.props.expiredAt,
        });
      }
      throw new UploadIntentNotFoundError({ publicId: input.publicId });
    }

    await this.auditWriteRepo.record({
      entityType: "upload_intent",
      entityId: input.publicId,
      action: "url_refreshed",
      occurredBy: input.requestedBy,
      afterState: {
        protocol,
        expiresAt: issued.expiresAt.toISOString(),
      },
    });

    const namespaceSlug: string | null = await this.assetQueryRepo.findNamespaceSlug(
      intent.props.namespaceId,
    );
    if (namespaceSlug !== null) {
      uploadIntentRefreshedCounter.add(1, {
        namespace_slug: namespaceSlug,
        protocol,
      });
    }

    return {
      uploadUrl: issued.uploadUrl,
      uploadHeaders: issued.uploadHeaders,
      expiresAt: issued.expiresAt,
      protocol,
    };
  }
}

/**
 * Derives the upload protocol from the persisted upload URL.
 *
 * Trade-off: a `protocol` column on `upload_intents` would be more robust.
 * The spec defers schema migrations for v1.0; this URL heuristic (GCS signed
 * URLs always contain "X-Goog-Signature") is sufficient and covered by unit
 * tests. A follow-up can add the column.
 */
function derivePersistedProtocol(uploadUrl: string): UploadProtocol {
  // tusd resource URLs are emitted by TusdUploadUrlIssuer below the configured
  // endpoint; signed GCS URLs always include "X-Goog-Signature".
  return uploadUrl.includes("X-Goog-Signature") ? "simple" : "tus";
}
