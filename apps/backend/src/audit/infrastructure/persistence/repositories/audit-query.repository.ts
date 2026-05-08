import { Injectable } from "@nestjs/common";

import {
  AuditPage,
  AuditQueryRepositoryPort,
  ListAuditInput,
} from "@/audit/domain/repositories/audit-query.repository.port";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { AuditEntryDbMapper } from "../mappers/audit-entry.db-mapper";

@Injectable()
export class AuditQueryRepository implements AuditQueryRepositoryPort {
  constructor(private readonly db: DatabaseClient) {}

  async list(input: ListAuditInput): Promise<AuditPage> {
    const offset = (input.page - 1) * input.limit;

    let countQuery = this.db.connection
      .selectFrom("configuration_audit_log")
      .select((eb) => eb.fn.countAll<string>().as("count"));

    let dataQuery = this.db.connection
      .selectFrom("configuration_audit_log")
      .selectAll()
      .orderBy("occurred_at", "desc");

    if (input.principal) {
      countQuery = countQuery.where("occurred_by", "=", input.principal);
      dataQuery = dataQuery.where("occurred_by", "=", input.principal);
    }

    if (input.action) {
      countQuery = countQuery.where("action", "=", input.action);
      dataQuery = dataQuery.where("action", "=", input.action);
    }

    if (input.entityType) {
      countQuery = countQuery.where("entity_type", "=", input.entityType);
      dataQuery = dataQuery.where("entity_type", "=", input.entityType);
    }

    if (input.entityId) {
      countQuery = countQuery.where("entity_id", "=", input.entityId);
      dataQuery = dataQuery.where("entity_id", "=", input.entityId);
    }

    if (input.occurredFrom) {
      const from = new Date(input.occurredFrom);
      countQuery = countQuery.where("occurred_at", ">=", from);
      dataQuery = dataQuery.where("occurred_at", ">=", from);
    }

    if (input.occurredTo) {
      const to = new Date(input.occurredTo);
      countQuery = countQuery.where("occurred_at", "<=", to);
      dataQuery = dataQuery.where("occurred_at", "<=", to);
    }

    if (input.q && input.q.trim().length > 0) {
      const needle = `%${input.q.trim()}%`;
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("entity_id", "ilike", needle),
          eb("occurred_by", "ilike", needle),
          eb("action", "ilike", needle),
        ]),
      );
      dataQuery = dataQuery.where((eb) =>
        eb.or([
          eb("entity_id", "ilike", needle),
          eb("occurred_by", "ilike", needle),
          eb("action", "ilike", needle),
        ]),
      );
    }

    const [{ count }] = await countQuery.execute();
    const total = Number(count);

    const rows = await dataQuery.limit(input.limit).offset(offset).execute();

    return {
      data: rows.map((row) => AuditEntryDbMapper.toDomain(row as Record<string, any>)),
      total,
      page: input.page,
      limit: input.limit,
      lastPage: Math.max(1, Math.ceil(total / input.limit)),
    };
  }
}
