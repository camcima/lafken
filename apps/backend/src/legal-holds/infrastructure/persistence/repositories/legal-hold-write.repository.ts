import { Injectable } from "@nestjs/common";
import type { Kysely, Transaction } from "kysely";
import { sql } from "kysely";

import { LegalHold } from "@/legal-holds/domain/entities/legal-hold.entity";
import { LegalHoldAlreadyLiftedError } from "@/legal-holds/domain/errors/legal-hold-already-lifted.error";
import { LegalHoldNotFoundError } from "@/legal-holds/domain/errors/legal-hold-not-found.error";
import {
  type ILiftLegalHoldInput,
  type ILiftLegalHoldResult,
  type IPlaceLegalHoldInput,
  LegalHoldWriteRepositoryPort,
} from "@/legal-holds/domain/repositories/legal-hold-write.repository.port";
import { ConnectionResolver } from "@/shared/infrastructure/persistence/connection-resolver";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import type { DB } from "@/shared/infrastructure/persistence/db.types";

import { LegalHoldDbMapper } from "../mappers/legal-hold.db-mapper";

const ZERO_ROWS_AFFECTED = 0n;

@Injectable()
export class LegalHoldWriteRepository extends LegalHoldWriteRepositoryPort {
  constructor(
    private readonly db: DatabaseClient,
    private readonly resolver: ConnectionResolver,
  ) {
    super();
  }

  async placeHold(input: IPlaceLegalHoldInput): Promise<LegalHold> {
    const conn = this.resolver.resolve();
    const isAlreadyInTx = conn !== this.db.connection;

    const work = async (tx: Kysely<DB> | Transaction<DB>): Promise<LegalHold> => {
      const [row] = await tx
        .insertInto("legal_holds")
        .values({
          case_reference: input.caseReference,
          description: input.description,
          scope_summary: input.scopeSummary,
          placed_by: input.placedBy,
          active: true,
        })
        .returningAll()
        .execute();

      if (input.assetInternalIds.length > 0) {
        await tx
          .insertInto("legal_hold_assets")
          .values(
            input.assetInternalIds.map((assetId) => ({
              legal_hold_id: (row as { id: string }).id,
              asset_id: assetId,
            })),
          )
          .onConflict((oc) => oc.columns(["legal_hold_id", "asset_id"]).doNothing())
          .execute();

        await tx
          .updateTable("assets")
          .set({
            legal_hold: true,
            legal_hold_reference: input.caseReference,
          })
          .where("id", "in", input.assetInternalIds)
          .execute();
      }

      return LegalHoldDbMapper.toDomain(row as Record<string, unknown>);
    };

    if (isAlreadyInTx) {
      return work(conn);
    }
    return this.db.connection.transaction().execute(work);
  }

  async liftHold(input: ILiftLegalHoldInput): Promise<ILiftLegalHoldResult> {
    const conn = this.resolver.resolve();
    const isAlreadyInTx = conn !== this.db.connection;

    const work = async (tx: Kysely<DB> | Transaction<DB>): Promise<ILiftLegalHoldResult> => {
      const row = await tx
        .updateTable("legal_holds")
        .set({
          active: false,
          lifted_by: input.liftedBy,
          lifted_at: sql<Date>`now()`,
          lift_reason: input.liftReason,
        })
        .where("id", "=", input.id)
        .where("active", "=", true)
        .returningAll()
        .executeTakeFirst();

      if (!row) {
        // Zero rows: either the hold doesn't exist, or a concurrent lift won
        // the race (the WHERE active = true re-evaluated to false).
        const existing = await tx
          .selectFrom("legal_holds")
          .select("id")
          .where("id", "=", input.id)
          .executeTakeFirst();
        if (existing) {
          throw new LegalHoldAlreadyLiftedError({ id: input.id });
        }
        throw new LegalHoldNotFoundError({ id: input.id });
      }

      // Recompute the denormalized flag + reference for every covered asset in
      // one statement, keyed on legal_hold_id (no in-memory id list).
      // Stacking-aware: assets still under another active hold keep
      // legal_hold = true with reference pointing at the most-recent active
      // hold's case_reference.
      const recompute = await sql`
        UPDATE assets a
        SET
          legal_hold = sub.still_held,
          legal_hold_reference = CASE WHEN sub.still_held THEN sub.latest_ref ELSE NULL END
        FROM (
          SELECT
            a2.id AS asset_id,
            EXISTS (
              SELECT 1
              FROM legal_hold_assets lha
              JOIN legal_holds lh ON lh.id = lha.legal_hold_id
              WHERE lha.asset_id = a2.id AND lh.active = true
            ) AS still_held,
            (
              SELECT lh.case_reference
              FROM legal_hold_assets lha
              JOIN legal_holds lh ON lh.id = lha.legal_hold_id
              WHERE lha.asset_id = a2.id AND lh.active = true
              ORDER BY lh.placed_at DESC
              LIMIT 1
            ) AS latest_ref
          FROM assets a2
          WHERE a2.id IN (
            SELECT lha0.asset_id
            FROM legal_hold_assets lha0
            WHERE lha0.legal_hold_id = ${input.id}
          )
        ) sub
        WHERE a.id = sub.asset_id
      `.execute(tx);

      return {
        hold: LegalHoldDbMapper.toDomain(row as Record<string, unknown>),
        affectedAssetCount: Number(recompute.numAffectedRows ?? ZERO_ROWS_AFFECTED),
      };
    };

    if (isAlreadyInTx) {
      return work(conn);
    }
    return this.db.connection.transaction().execute(work);
  }
}
