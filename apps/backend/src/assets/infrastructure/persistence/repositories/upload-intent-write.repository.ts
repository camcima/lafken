import { Injectable } from "@nestjs/common";

import { UploadIntent } from "@/assets/domain/entities/upload-intent.entity";
import {
  type IInsertUploadIntentInput,
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
}
