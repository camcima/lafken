import { Injectable } from "@nestjs/common";

import {
  ListQuarantineInput,
  QuarantinedAssetPage,
  QuarantineQueryRepositoryPort,
} from "@/quarantine/domain/repositories/quarantine-query.repository.port";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { QuarantinedAssetViewDbMapper } from "../mappers/quarantined-asset-view.db-mapper";

const QUARANTINED_STATES = [
  "quarantined_virus",
  "quarantined_moderation",
  "quarantined_invalid_format",
] as const;

@Injectable()
export class QuarantineQueryRepository implements QuarantineQueryRepositoryPort {
  constructor(private readonly db: DatabaseClient) {}

  async list(input: ListQuarantineInput): Promise<QuarantinedAssetPage> {
    const offset = (input.page - 1) * input.limit;

    // Resolve kind filter to the actual state value(s)
    const stateFilter: string[] =
      input.kind === "virus"
        ? ["quarantined_virus"]
        : input.kind === "moderation"
          ? ["quarantined_moderation"]
          : input.kind === "invalid_format"
            ? ["quarantined_invalid_format"]
            : [...QUARANTINED_STATES];

    let countQuery = this.db.connection
      .selectFrom("assets")
      .innerJoin("namespaces", "namespaces.id", "assets.namespace_id")
      .innerJoin("namespace_policies as policy", "policy.id", "assets.policy_version_id")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("assets.state", "in", stateFilter);

    // NOTE: selectAll("assets") avoids column-shadowing from joined tables.
    // The latest-analysis lateral join is deferred to Slice 1;
    // flagged* fields fall back to NULL and state_changed_at for flaggedAt.
    let dataQuery = this.db.connection
      .selectFrom("assets")
      .innerJoin("namespaces", "namespaces.id", "assets.namespace_id")
      .innerJoin("namespace_policies as policy", "policy.id", "assets.policy_version_id")
      .selectAll("assets")
      .select([
        "namespaces.slug as namespace_slug",
        "policy.version as policy_version",
        // Deferred (Slice 1): lateral join to asset_analyses for latest flagging analysis.
        // Until then, these resolve to NULL; state_changed_at is used as flagged_at.
        "assets.state_changed_at as flagged_at",
      ])
      .where("assets.state", "in", stateFilter)
      .orderBy("assets.state_changed_at", "desc");

    if (input.namespaceSlug) {
      countQuery = countQuery.where("namespaces.slug", "=", input.namespaceSlug);
      dataQuery = dataQuery.where("namespaces.slug", "=", input.namespaceSlug);
    }

    if (input.flaggedFrom) {
      const from = new Date(input.flaggedFrom);
      countQuery = countQuery.where("assets.state_changed_at", ">=", from);
      dataQuery = dataQuery.where("assets.state_changed_at", ">=", from);
    }

    if (input.flaggedTo) {
      const to = new Date(input.flaggedTo);
      countQuery = countQuery.where("assets.state_changed_at", "<=", to);
      dataQuery = dataQuery.where("assets.state_changed_at", "<=", to);
    }

    const [{ count }] = await countQuery.execute();
    const total = Number(count);

    const rows = await dataQuery.limit(input.limit).offset(offset).execute();

    return {
      data: rows.map((row) => QuarantinedAssetViewDbMapper.toDomain(row as Record<string, any>)),
      total,
      page: input.page,
      limit: input.limit,
      lastPage: Math.max(1, Math.ceil(total / input.limit)),
    };
  }
}
