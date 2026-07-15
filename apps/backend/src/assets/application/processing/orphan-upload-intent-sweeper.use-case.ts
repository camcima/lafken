import { Injectable, Optional } from "@nestjs/common";

import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { UploadIntentWriteRepositoryPort } from "@/assets/domain/repositories/upload-intent-write.repository.port";
import { AssetStoragePort } from "@/assets/domain/services/asset-storage.service.port";
import { AuditWriteRepositoryPort } from "@/audit/domain/repositories/audit-write.repository.port";
import { AppLoggerPort } from "@/shared/application/app-logger.port";
import { MetricsPort } from "@/shared/application/metrics.port";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

export interface IOrphanSweepInput {
  now: Date;
  graceMs: number;
  batchSize: number;
}

@Injectable()
export class OrphanUploadIntentSweeperUseCase {
  constructor(
    private readonly intents: UploadIntentWriteRepositoryPort,
    private readonly bindings: StorageBindingQueryRepositoryPort,
    private readonly storage: AssetStoragePort,
    private readonly auditWriteRepo: AuditWriteRepositoryPort,
    private readonly assetQueryRepo: AssetQueryRepositoryPort,
    @Optional()
    private readonly logger?: AppLoggerPort,
    @Optional()
    private readonly metrics?: MetricsPort,
  ) {
    this.logger?.setContext(OrphanUploadIntentSweeperUseCase.name);
  }

  async execute(input: IOrphanSweepInput): Promise<void> {
    const expiresBefore: Date = new Date(input.now.getTime() - input.graceMs);
    const orphans = await this.intents.findOrphanedForSweep({
      now: input.now,
      graceMs: input.graceMs,
      limit: input.batchSize,
    });
    // Cache slug lookups across the batch — neighbouring intents typically share
    // a namespace and we don't want N queries per sweep tick.
    const slugByNamespaceId: Map<string, string | null> = new Map();
    for (const intent of orphans) {
      const transitioned = await this.intents.markExpired({
        publicId: intent.props.publicId,
        now: input.now,
        expiresBefore,
      });
      if (!transitioned) {
        // Another worker / consumer beat us — leave bytes alone.
        continue;
      }
      try {
        const binding = await this.bindings.findById(intent.props.storageBindingId);
        if (binding) {
          const gcs = binding.getGcsConfig();
          await this.storage.deleteObject({
            binding: { bucket: gcs.bucket, projectId: gcs.projectId },
            storageKey: intent.props.storageKey,
          });
        }
      } catch (err) {
        // Best-effort delete: storage failures (including "not found") must not
        // roll back the audit row. Log and proceed.
        this.logger?.warn(
          {
            publicId: intent.props.publicId,
            storageKey: intent.props.storageKey,
            err: err instanceof Error ? err.message : String(err),
          },
          "orphan sweep delete failed; proceeding with audit",
        );
      }
      await this.auditWriteRepo.record({
        entityType: "upload_intent",
        entityId: intent.props.publicId,
        action: "expired",
        occurredBy: "system:orphan-sweeper",
      });

      let slug: string | null | undefined = slugByNamespaceId.get(intent.props.namespaceId);
      if (slug === undefined) {
        slug = await this.assetQueryRepo.findNamespaceSlug(intent.props.namespaceId);
        slugByNamespaceId.set(intent.props.namespaceId, slug);
      }
      if (slug !== null) {
        this.metrics?.recordUploadIntentExpiredSwept({ namespaceSlug: slug });
      }
    }
  }
}
