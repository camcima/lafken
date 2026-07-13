import { Injectable } from "@nestjs/common";
import type { Kysely, Transaction } from "kysely";

import { Asset } from "@/assets/domain/entities/asset.entity";
import { UploadIntentConsumeConflictError } from "@/assets/domain/errors/upload-intent-consume-conflict.error";
import {
  AssetWriteRepositoryPort,
  type ICreateUploadedAssetInput,
  type ITransitionStateInput,
} from "@/assets/domain/repositories/asset-write.repository.port";
import { ConnectionResolver } from "@/shared/infrastructure/persistence/connection-resolver";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import type { DB } from "@/shared/infrastructure/persistence/db.types";

import { AssetDbMapper } from "../mappers/asset.db-mapper";

@Injectable()
export class AssetWriteRepository implements AssetWriteRepositoryPort {
  constructor(
    private readonly db: DatabaseClient,
    private readonly resolver: ConnectionResolver,
  ) {}

  async createUploadedAsset(input: ICreateUploadedAssetInput): Promise<Asset> {
    const initialState: string = input.initialState ?? "uploaded";
    const transitionReason: string =
      input.initialStateReason ??
      (initialState === "uploaded" ? "upload_confirmed" : "upload_quarantined");

    const conn = this.resolver.resolve();
    const isAlreadyInTx = conn !== this.db.connection;

    const work = async (tx: Kysely<DB> | Transaction<DB>): Promise<Asset> => {
      // 1. Atomically consume the intent. The fences guarantee exactly one
      //    confirm wins and that a sweeper-expired intent (bytes already
      //    deleted) can never become an asset. rowcount must be 1 — anything
      //    else throws so the surrounding transaction rolls back (F-P7/F-P8).
      const consumed = await tx
        .updateTable("upload_intents")
        .set({ consumed_at: new Date() })
        .where("public_id", "=", input.publicId)
        .where("consumed_at", "is", null)
        .where("expired_at", "is", null)
        .executeTakeFirst();
      if (Number(consumed.numUpdatedRows) !== 1) {
        throw new UploadIntentConsumeConflictError({ publicId: input.publicId });
      }

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
    };

    if (isAlreadyInTx) {
      return work(conn);
    }
    return this.db.connection.transaction().execute(work);
  }

  async transitionState(input: ITransitionStateInput): Promise<Asset | null> {
    const conn = this.resolver.resolve();
    const isAlreadyInTx = conn !== this.db.connection;

    const work = async (tx: Kysely<DB> | Transaction<DB>): Promise<Asset | null> => {
      const existing = await tx
        .selectFrom("assets")
        .select(["id", "state"])
        .where("public_id", "=", input.publicId)
        .executeTakeFirst();
      if (!existing) return null;

      const fromState: string = (existing as { state: string }).state;
      const assetId: string = (existing as { id: string }).id;
      if (input.expectedFromState !== undefined && fromState !== input.expectedFromState) {
        return null;
      }
      const now = new Date();

      const setExpression: Record<string, unknown> = {
        state: input.toState,
        state_reason: input.reason,
        state_changed_at: now,
      };
      if (input.newStorageKey !== undefined) {
        setExpression.storage_key = input.newStorageKey;
      }
      let updateQuery = tx.updateTable("assets").set(setExpression).where("id", "=", assetId);
      if (input.expectedFromState !== undefined) {
        // The CAS lives in the UPDATE's WHERE clause: under READ COMMITTED a
        // concurrent transition commits first, this UPDATE re-evaluates the
        // predicate against the new row version and matches zero rows.
        updateQuery = updateQuery.where("state", "=", input.expectedFromState);
      }
      const updated = await updateQuery.returningAll().executeTakeFirst();
      if (!updated) return null;

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
    };

    if (isAlreadyInTx) {
      return work(conn);
    }
    return this.db.connection.transaction().execute(work);
  }
}
