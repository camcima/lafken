import { Injectable, Optional } from "@nestjs/common";

import { UploadIntentWriteRepositoryPort } from "@/assets/domain/repositories/upload-intent-write.repository.port";
import { AssetStoragePort } from "@/assets/domain/services/asset-storage.service.port";
import { AuditWriteRepositoryPort } from "@/audit/domain/repositories/audit-write.repository.port";
import { AppLoggerPort } from "@/shared/application/app-logger.port";
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
    @Optional()
    private readonly logger?: AppLoggerPort,
  ) {
    this.logger?.setContext(OrphanUploadIntentSweeperUseCase.name);
  }

  async execute(input: IOrphanSweepInput): Promise<void> {
    const orphans = await this.intents.findOrphanedForSweep({
      now: input.now,
      graceMs: input.graceMs,
      limit: input.batchSize,
    });
    for (const intent of orphans) {
      const transitioned = await this.intents.markExpired(intent.props.publicId, input.now);
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
    }
  }
}
