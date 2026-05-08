import { Injectable } from "@nestjs/common";

import { Asset } from "@/assets/domain/entities/asset.entity";
import {
  AssetWriteRepositoryPort,
  type ICreateUploadedAssetInput,
  type ITransitionStateInput,
} from "@/assets/domain/repositories/asset-write.repository.port";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { AssetDbMapper } from "../mappers/asset.db-mapper";

@Injectable()
export class AssetWriteRepository implements AssetWriteRepositoryPort {
  constructor(private readonly db: DatabaseClient) {}

  async createUploadedAsset(input: ICreateUploadedAssetInput): Promise<Asset> {
    const initialState: string = input.initialState ?? "uploaded";
    const transitionReason: string =
      input.initialStateReason ??
      (initialState === "uploaded" ? "upload_confirmed" : "upload_quarantined");

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
          state: initialState,
          state_reason: input.initialStateReason ?? null,
          declared_mime_type: input.declaredMimeType,
          size_bytes: input.declaredSizeBytes,
          width: input.width ?? null,
          height: input.height ?? null,
          uploaded_by: input.uploadedBy ?? undefined,
          external_ref_type: input.externalRefType ?? null,
          external_ref_id: input.externalRefId ?? null,
          custom_metadata: input.customMetadata,
          tags: input.tags,
          effective_max_size_bytes: input.effectiveMaxSizeBytes,
          effective_url_ttl: input.effectiveUrlTtl,
          confirmed_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const assetId = (assetRow as { id: string }).id;

      // 3. Insert state-transition row (NULL → initial state).
      await tx
        .insertInto("asset_state_transitions")
        .values({
          asset_id: assetId,
          from_state: null,
          to_state: initialState,
          reason: transitionReason,
          metadata: { intent_id: input.intentId },
          occurred_by: input.uploadedBy ?? undefined,
        })
        .execute();

      // 4. Optional inline analysis (only for non-uploaded paths today).
      if (input.initialAnalysis) {
        await tx
          .insertInto("asset_analyses")
          .values({
            asset_id: assetId,
            analyzer: input.initialAnalysis.analyzer,
            analyzer_version: input.initialAnalysis.analyzerVersion,
            findings: input.initialAnalysis.findings,
            decision: input.initialAnalysis.decision,
          })
          .execute();
      }

      // 5. Enqueue a processing_jobs row only for the happy path. Assets that
      //    landed in a quarantine state shouldn't be picked up by the worker —
      //    the worker doesn't know about review/release semantics, so a queued
      //    job would just transition the asset out of quarantine on its own.
      //    A future release flow can insert a fresh job after a reviewer
      //    explicitly clears the hold.
      if (initialState === "uploaded") {
        await tx
          .insertInto("processing_jobs")
          .values({
            asset_id: assetId,
            state: "released",
            not_before: new Date(),
            attempt_number: 1,
          })
          .execute();
      }

      return AssetDbMapper.toDomain(assetRow as Record<string, any>);
    });
  }

  async transitionState(input: ITransitionStateInput): Promise<Asset | null> {
    return this.db.connection.transaction().execute(async (tx) => {
      const existing = await tx
        .selectFrom("assets")
        .select(["id", "state"])
        .where("public_id", "=", input.publicId)
        .executeTakeFirst();
      if (!existing) return null;

      const fromState: string = (existing as { state: string }).state;
      const assetId: string = (existing as { id: string }).id;
      const now = new Date();

      const setExpression: Record<string, unknown> = {
        state: input.toState,
        state_reason: input.reason,
        state_changed_at: now,
      };
      if (input.newStorageKey !== undefined) {
        setExpression.storage_key = input.newStorageKey;
      }
      const updated = await tx
        .updateTable("assets")
        .set(setExpression)
        .where("id", "=", assetId)
        .returningAll()
        .executeTakeFirstOrThrow();

      await tx
        .insertInto("asset_state_transitions")
        .values({
          asset_id: assetId,
          from_state: fromState,
          to_state: input.toState,
          reason: input.reason,
          metadata: input.metadata ?? null,
          occurred_by: input.by ?? undefined,
        })
        .execute();

      return AssetDbMapper.toDomain(updated as Record<string, any>);
    });
  }
}
