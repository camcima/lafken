import { Injectable } from "@nestjs/common";

import type { Asset } from "@/assets/domain/entities/asset.entity";
import {
  AssetProcessingRepositoryPort,
  type IAssetWithPolicy,
  type IRecordAnalysisInput,
  type IRestartProcessingInput,
  type ITransitionAssetInput,
  type IUpdateDerivedMetadataInput,
} from "@/assets/domain/repositories/asset-processing.repository.port";
import type { AssetState } from "@/assets/domain/value-objects/asset-state.value-object";
import type { NamespacePolicy } from "@/namespaces/domain/entities/namespace-policy.entity";
import { NamespacePolicyDbMapper } from "@/namespaces/infrastructure/persistence/mappers/namespace-policy.db-mapper";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { AssetDbMapper } from "../mappers/asset.db-mapper";

interface IUpdateResultLike {
  numUpdatedRows: bigint;
}

const ZERO_UPDATED_ROWS = 0n;

@Injectable()
export class AssetProcessingRepository extends AssetProcessingRepositoryPort {
  constructor(private readonly db: DatabaseClient) {
    super();
  }

  async findAssetWithPolicy(assetId: string): Promise<IAssetWithPolicy | null> {
    const assetRow = await this.db.connection
      .selectFrom("assets")
      .selectAll()
      .where("id", "=", assetId)
      .executeTakeFirst();

    if (!assetRow) {
      return null;
    }

    const policyRow = await this.db.connection
      .selectFrom("namespace_policies")
      .selectAll()
      .where("id", "=", assetRow.policy_version_id)
      .executeTakeFirst();

    if (!policyRow) {
      return null;
    }

    const asset: Asset = AssetDbMapper.toDomain(assetRow);
    const policy: NamespacePolicy = NamespacePolicyDbMapper.toDomain(policyRow);
    return { asset, policy };
  }

  async transitionAsset(input: ITransitionAssetInput): Promise<boolean> {
    return this.db.connection.transaction().execute(async (tx): Promise<boolean> => {
      const updateValues: {
        state: AssetState;
        state_reason: string;
        state_changed_at: Date;
        storage_key?: string;
      } = {
        state: input.toState,
        state_reason: input.reason,
        state_changed_at: input.now,
      };
      if (input.newStorageKey !== undefined) {
        updateValues.storage_key = input.newStorageKey;
      }
      const updated = await tx
        .updateTable("assets")
        .set(updateValues)
        .where("id", "=", input.assetId)
        .where("state", "=", input.fromState)
        .executeTakeFirst();

      if (!this.hasUpdatedRows(updated)) {
        return false;
      }

      await tx
        .insertInto("asset_state_transitions")
        .values({
          asset_id: input.assetId,
          from_state: input.fromState,
          to_state: input.toState,
          reason: input.reason,
          metadata: input.metadata,
          occurred_by: input.occurredBy,
          occurred_at: input.now,
        })
        .execute();

      return true;
    });
  }

  async recordAnalysis(input: IRecordAnalysisInput): Promise<void> {
    await this.db.connection
      .insertInto("asset_analyses")
      .values({
        asset_id: input.assetId,
        analyzer: input.analyzer,
        analyzer_version: input.analyzerVersion,
        findings: input.findings,
        decision: input.decision,
        occurred_at: input.occurredAt,
      })
      .execute();
  }

  async updateDerivedMetadata(input: IUpdateDerivedMetadataInput): Promise<void> {
    await this.db.connection
      .updateTable("assets")
      .set({
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        width: input.width,
        height: input.height,
        content_hash: input.contentHash,
        phash: input.phash ?? null,
        capture_context: input.captureContext,
      })
      .where("id", "=", input.assetId)
      .execute();
  }

  /**
   * Re-primes a `processing_failed` asset for another worker attempt. The
   * `processing_jobs.asset_id` column is the table's primary key, so there is
   * always at most one row per asset; we use `onConflict ... doUpdateSet` to
   * cover both "row exists from a previous attempt" (the common case) and the
   * defensive "row is somehow absent" path in a single statement. The whole
   * operation runs in one transaction so a race that loses the asset
   * transition leaves the job row untouched.
   */
  async restartProcessing(input: IRestartProcessingInput): Promise<boolean> {
    return this.db.connection.transaction().execute(async (tx): Promise<boolean> => {
      const updated = await tx
        .updateTable("assets")
        .set({
          state: "uploaded",
          state_reason: input.reason,
          state_changed_at: input.now,
        })
        .where("id", "=", input.assetId)
        .where("state", "=", "processing_failed")
        .executeTakeFirst();

      if (!this.hasUpdatedRows(updated)) {
        return false;
      }

      await tx
        .insertInto("asset_state_transitions")
        .values({
          asset_id: input.assetId,
          from_state: "processing_failed",
          to_state: "uploaded",
          reason: input.reason,
          metadata: { reason_code: input.reason, requested_by: input.requestedByEmail },
          occurred_by: input.requestedByEmail,
          occurred_at: input.now,
        })
        .execute();

      await tx
        .insertInto("processing_jobs")
        .values({
          asset_id: input.assetId,
          state: "released",
          worker_id: null,
          claimed_at: null,
          heartbeat_at: null,
          current_step: null,
          attempt_number: 1,
          not_before: input.now,
          last_error: null,
          last_error_at: null,
        })
        .onConflict((oc) =>
          oc.column("asset_id").doUpdateSet({
            state: "released",
            worker_id: null,
            claimed_at: null,
            heartbeat_at: null,
            current_step: null,
            attempt_number: 1,
            not_before: input.now,
            last_error: null,
            last_error_at: null,
          }),
        )
        .execute();

      return true;
    });
  }

  private hasUpdatedRows(result: IUpdateResultLike): boolean {
    return result.numUpdatedRows > ZERO_UPDATED_ROWS;
  }
}
