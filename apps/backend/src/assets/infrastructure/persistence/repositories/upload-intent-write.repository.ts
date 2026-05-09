import { Injectable } from "@nestjs/common";

import { UploadIntent } from "@/assets/domain/entities/upload-intent.entity";
import {
  type IFindOrphanedForSweepInput,
  type IInsertUploadIntentInput,
  type IRefreshUploadUrlInput,
  UploadIntentWriteRepositoryPort,
} from "@/assets/domain/repositories/upload-intent-write.repository.port";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { UploadIntentDbMapper } from "../mappers/upload-intent.db-mapper";

@Injectable()
export class UploadIntentWriteRepository implements UploadIntentWriteRepositoryPort {
  constructor(private readonly db: DatabaseClient) {}

  async insert(input: IInsertUploadIntentInput): Promise<UploadIntent> {
    const row = await this.db.connection
      .insertInto("upload_intents")
      .values({
        public_id: input.publicId,
        namespace_id: input.namespaceId,
        policy_version_id: input.policyVersionId,
        storage_binding_id: input.storageBindingId,
        storage_key: input.storageKey,
        declared_mime_type: input.declaredMimeType,
        declared_size_bytes: input.declaredSizeBytes,
        upload_url: input.uploadUrl,
        upload_url_expires_at: input.uploadUrlExpiresAt,
        created_by: input.createdBy ?? undefined,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return UploadIntentDbMapper.toDomain(row as Record<string, any>);
  }

  async findByPublicId(publicId: string): Promise<UploadIntent | null> {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(publicId)) return null;

    const row = await this.db.connection
      .selectFrom("upload_intents")
      .selectAll()
      .where("public_id", "=", publicId)
      .executeTakeFirst();

    return row ? UploadIntentDbMapper.toDomain(row as Record<string, any>) : null;
  }

  async markConsumed(publicId: string): Promise<void> {
    await this.db.connection
      .updateTable("upload_intents")
      .set({ consumed_at: new Date() })
      .where("public_id", "=", publicId)
      .where("consumed_at", "is", null)
      .execute();
  }

  async findOrphanedForSweep(input: IFindOrphanedForSweepInput): Promise<UploadIntent[]> {
    const cutoff = new Date(input.now.getTime() - input.graceMs);
    const rows = await this.db.connection
      .selectFrom("upload_intents")
      .selectAll()
      .where("consumed_at", "is", null)
      .where("expired_at", "is", null)
      .where("upload_url_expires_at", "<", cutoff)
      .orderBy("upload_url_expires_at", "asc")
      .limit(input.limit)
      .execute();
    return rows.map((row) => UploadIntentDbMapper.toDomain(row as Record<string, any>));
  }

  async markExpired(publicId: string, now: Date): Promise<boolean> {
    const result = await this.db.connection
      .updateTable("upload_intents")
      .set({ expired_at: now })
      .where("public_id", "=", publicId)
      .where("consumed_at", "is", null)
      .where("expired_at", "is", null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows) > 0;
  }

  async refreshUploadUrl(input: IRefreshUploadUrlInput): Promise<boolean> {
    const result = await this.db.connection
      .updateTable("upload_intents")
      .set({
        upload_url: input.uploadUrl,
        upload_url_expires_at: input.uploadUrlExpiresAt,
      })
      .where("public_id", "=", input.publicId)
      .where("consumed_at", "is", null)
      .where("expired_at", "is", null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows) > 0;
  }
}
