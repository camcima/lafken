import { Injectable } from "@nestjs/common";
import { sql } from "kysely";

import type { AssetAnalysis } from "@/assets/domain/entities/asset-analysis.entity";
import type { AssetStateTransition } from "@/assets/domain/entities/asset-state-transition.entity";
import type { Asset } from "@/assets/domain/entities/asset.entity";
import type { ProcessingJob } from "@/assets/domain/entities/processing-job.entity";
import {
  AssetPage,
  AssetQueryRepositoryPort,
  IAssetPublicIdResolution,
  ListAssetsInput,
  NamespaceStorageUsage,
} from "@/assets/domain/repositories/asset-query.repository.port";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { computeLastPage } from "@/shared/kernel/domain/pagination";

import { AssetAnalysisDbMapper } from "../mappers/asset-analysis.db-mapper";
import { AssetStateTransitionDbMapper } from "../mappers/asset-state-transition.db-mapper";
import { AssetDbMapper } from "../mappers/asset.db-mapper";
import { ProcessingJobDbMapper } from "../mappers/processing-job.db-mapper";

@Injectable()
export class AssetQueryRepository implements AssetQueryRepositoryPort {
  constructor(private readonly db: DatabaseClient) {}

  async list(input: ListAssetsInput): Promise<AssetPage> {
    const offset = (input.page - 1) * input.limit;

    let countQuery = this.db.connection
      .selectFrom("assets")
      .select((eb) => eb.fn.countAll<string>().as("count"));

    let dataQuery = this.db.connection
      .selectFrom("assets")
      .selectAll("assets")
      .orderBy("assets.created_at", "desc");

    if (input.namespaceSlug) {
      countQuery = countQuery
        .innerJoin("namespaces", "namespaces.id", "assets.namespace_id")
        .where("namespaces.slug", "=", input.namespaceSlug);

      dataQuery = dataQuery
        .innerJoin("namespaces", "namespaces.id", "assets.namespace_id")
        .where("namespaces.slug", "=", input.namespaceSlug);
    }

    if (input.states && input.states.length > 0) {
      countQuery = countQuery.where("assets.state", "in", input.states);
      dataQuery = dataQuery.where("assets.state", "in", input.states);
    }

    if (input.uploadedBy) {
      countQuery = countQuery.where("assets.uploaded_by", "=", input.uploadedBy);
      dataQuery = dataQuery.where("assets.uploaded_by", "=", input.uploadedBy);
    }

    if (input.externalRefType) {
      countQuery = countQuery.where("assets.external_ref_type", "=", input.externalRefType);
      dataQuery = dataQuery.where("assets.external_ref_type", "=", input.externalRefType);
    }

    if (input.externalRefId) {
      countQuery = countQuery.where("assets.external_ref_id", "=", input.externalRefId);
      dataQuery = dataQuery.where("assets.external_ref_id", "=", input.externalRefId);
    }

    if (input.uploadedFrom) {
      countQuery = countQuery.where("assets.created_at", ">=", new Date(input.uploadedFrom));
      dataQuery = dataQuery.where("assets.created_at", ">=", new Date(input.uploadedFrom));
    }

    if (input.uploadedTo) {
      countQuery = countQuery.where("assets.created_at", "<=", new Date(input.uploadedTo));
      dataQuery = dataQuery.where("assets.created_at", "<=", new Date(input.uploadedTo));
    }

    if (input.tags && input.tags.length > 0) {
      const tagsArray = input.tags;
      countQuery = countQuery.where(
        sql<boolean>`${sql.ref("assets.tags")} @> ${tagsArray}::text[]`,
      );
      dataQuery = dataQuery.where(sql<boolean>`${sql.ref("assets.tags")} @> ${tagsArray}::text[]`);
    }

    if (input.legalHoldId) {
      countQuery = countQuery
        .innerJoin("legal_hold_assets", "legal_hold_assets.asset_id", "assets.id")
        .where("legal_hold_assets.legal_hold_id", "=", input.legalHoldId);

      dataQuery = dataQuery
        .innerJoin("legal_hold_assets", "legal_hold_assets.asset_id", "assets.id")
        .where("legal_hold_assets.legal_hold_id", "=", input.legalHoldId);
    }

    const trimmedQ: string = input.q?.trim() ?? "";
    if (trimmedQ.length > 0) {
      // Escape LIKE wildcards so the user's input is matched literally; the
      // bracketing % wildcards we add do the substring work.
      const escaped: string = trimmedQ.replace(/[\\%_]/g, (ch) => `\\${ch}`);
      const pattern = `%${escaped}%`;
      countQuery = countQuery.where((eb) =>
        eb.or([
          sql<boolean>`${eb.ref("assets.public_id")}::text ILIKE ${pattern}`,
          eb("assets.external_ref_id", "ilike", pattern),
          eb("assets.uploaded_by", "ilike", pattern),
          sql<boolean>`encode(${eb.ref("assets.content_hash")}, 'hex') ILIKE ${pattern}`,
          sql<boolean>`EXISTS (SELECT 1 FROM unnest(${eb.ref("assets.tags")}) AS t WHERE t ILIKE ${pattern})`,
        ]),
      );
      dataQuery = dataQuery.where((eb) =>
        eb.or([
          sql<boolean>`${eb.ref("assets.public_id")}::text ILIKE ${pattern}`,
          eb("assets.external_ref_id", "ilike", pattern),
          eb("assets.uploaded_by", "ilike", pattern),
          sql<boolean>`encode(${eb.ref("assets.content_hash")}, 'hex') ILIKE ${pattern}`,
          sql<boolean>`EXISTS (SELECT 1 FROM unnest(${eb.ref("assets.tags")}) AS t WHERE t ILIKE ${pattern})`,
        ]),
      );
    }

    const [{ count }] = await countQuery.execute();
    const total = Number(count);

    const rows = await dataQuery.limit(input.limit).offset(offset).execute();

    return {
      data: rows.map((row) => AssetDbMapper.toDomain(row as Record<string, any>)),
      total,
      page: input.page,
      limit: input.limit,
      lastPage: computeLastPage(total, input.limit),
    };
  }

  async findById(id: string): Promise<Asset | null> {
    // PostgreSQL will reject non-UUID strings with an error; treat those as not found.
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(id)) {
      return null;
    }
    const row = await this.db.connection
      .selectFrom("assets")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? AssetDbMapper.toDomain(row as Record<string, any>) : null;
  }

  async findByPublicId(publicId: string): Promise<Asset | null> {
    // PostgreSQL will reject non-UUID strings with an error; treat those as not found.
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(publicId)) {
      return null;
    }
    const row = await this.db.connection
      .selectFrom("assets")
      .selectAll()
      .where("public_id", "=", publicId)
      .executeTakeFirst();
    return row ? AssetDbMapper.toDomain(row as Record<string, any>) : null;
  }

  async listStateTransitions(assetId: string): Promise<AssetStateTransition[]> {
    const rows = await this.db.connection
      .selectFrom("asset_state_transitions")
      .selectAll()
      .where("asset_id", "=", assetId)
      .orderBy("occurred_at", "asc")
      .execute();
    return rows.map((row) => AssetStateTransitionDbMapper.toDomain(row as Record<string, any>));
  }

  async listAnalyses(assetId: string): Promise<AssetAnalysis[]> {
    const rows = await this.db.connection
      .selectFrom("asset_analyses")
      .selectAll()
      .where("asset_id", "=", assetId)
      .orderBy("occurred_at", "desc")
      .execute();
    return rows.map((row) => AssetAnalysisDbMapper.toDomain(row as Record<string, any>));
  }

  async findProcessingJob(assetId: string): Promise<ProcessingJob | null> {
    const row = await this.db.connection
      .selectFrom("processing_jobs")
      .selectAll()
      .where("asset_id", "=", assetId)
      .executeTakeFirst();
    return row ? ProcessingJobDbMapper.toDomain(row as Record<string, any>) : null;
  }

  async findNamespaceSlug(namespaceId: string): Promise<string | null> {
    const row = await this.db.connection
      .selectFrom("namespaces")
      .select("slug")
      .where("id", "=", namespaceId)
      .executeTakeFirst();
    return (row as { slug?: string } | undefined)?.slug ?? null;
  }

  async findPolicyVersion(policyVersionId: string): Promise<number | null> {
    const row = await this.db.connection
      .selectFrom("namespace_policies")
      .select("version")
      .where("id", "=", policyVersionId)
      .executeTakeFirst();
    return (row as { version?: number } | undefined)?.version ?? null;
  }

  async getNamespaceStorageUsage(namespaceId: string): Promise<NamespaceStorageUsage> {
    const row = await this.db.connection
      .selectFrom("assets")
      .select((eb) => [
        eb.fn.sum<string | null>("size_bytes").as("total_bytes"),
        eb.fn.countAll<string>().as("asset_count"),
      ])
      .where("namespace_id", "=", namespaceId)
      .where("size_bytes", "is not", null)
      .where("state", "not in", ["expired", "deleted"])
      .executeTakeFirstOrThrow();

    const ZERO_BYTES = 0n;
    const totalBytesRaw = (row as { total_bytes: string | null }).total_bytes;
    return {
      totalBytes: totalBytesRaw === null ? ZERO_BYTES : BigInt(totalBytesRaw),
      assetCount: Number((row as { asset_count: string }).asset_count),
    };
  }

  async findInternalIdsAndNamespaceSlugsByPublicIds(
    publicIds: string[],
  ): Promise<IAssetPublicIdResolution[]> {
    if (publicIds.length === 0) return [];

    const rows = await this.db.connection
      .selectFrom("assets")
      .innerJoin("namespaces", "namespaces.id", "assets.namespace_id")
      .select([
        "assets.id as id",
        "assets.public_id as public_id",
        "namespaces.slug as namespace_slug",
      ])
      .where("assets.public_id", "in", publicIds)
      .execute();

    return rows.map((row) => ({
      id: row.id,
      publicId: row.public_id,
      namespaceSlug: row.namespace_slug,
    }));
  }
}
