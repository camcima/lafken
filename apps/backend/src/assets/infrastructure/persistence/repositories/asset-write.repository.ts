import { Injectable } from "@nestjs/common";

import { Asset } from "@/assets/domain/entities/asset.entity";
import {
  AssetWriteRepositoryPort,
  type ICreateUploadedAssetInput,
} from "@/assets/domain/repositories/asset-write.repository.port";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { AssetDbMapper } from "../mappers/asset.db-mapper";

@Injectable()
export class AssetWriteRepository implements AssetWriteRepositoryPort {
  constructor(private readonly db: DatabaseClient) {}

  async createUploadedAsset(input: ICreateUploadedAssetInput): Promise<Asset> {
    return this.db.connection.transaction().execute(async (tx) => {
      // 1. Mark intent consumed (idempotent — guarded by consumed_at IS NULL).
      await tx
        .updateTable("upload_intents")
        .set({ consumed_at: new Date() })
        .where("public_id", "=", input.publicId)
        .where("consumed_at", "is", null)
        .execute();

      // 2. Insert asset row (DB defaults populate id, created_at, updated_at,
      //    state_changed_at, custom_metadata={}, client_overrides={}, legal_hold=false).
      const assetRow = await tx
        .insertInto("assets")
        .values({
          public_id: input.publicId,
          namespace_id: input.namespaceId,
          policy_version_id: input.policyVersionId,
          storage_binding_id: input.storageBindingId,
          storage_key: input.storageKey,
          state: "uploaded",
          declared_mime_type: input.declaredMimeType,
          size_bytes: input.declaredSizeBytes,
          uploaded_by: input.uploadedBy ?? undefined,
          effective_max_size_bytes: input.effectiveMaxSizeBytes,
          effective_url_ttl: input.effectiveUrlTtl,
          confirmed_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const assetId = (assetRow as { id: string }).id;

      // 3. Insert state-transition row (NULL → uploaded).
      await tx
        .insertInto("asset_state_transitions")
        .values({
          asset_id: assetId,
          from_state: null,
          to_state: "uploaded",
          reason: "upload_confirmed",
          metadata: { intent_id: input.intentId },
          occurred_by: input.uploadedBy ?? undefined,
        })
        .execute();

      // 4. Insert processing_jobs row (released, ready for future worker).
      await tx
        .insertInto("processing_jobs")
        .values({
          asset_id: assetId,
          state: "released",
          not_before: new Date(),
          attempt_number: 1,
        })
        .execute();

      return AssetDbMapper.toDomain(assetRow as Record<string, any>);
    });
  }
}
