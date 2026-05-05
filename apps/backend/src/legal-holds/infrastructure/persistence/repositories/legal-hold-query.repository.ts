import { Injectable } from "@nestjs/common";

import { LegalHold } from "@/legal-holds/domain/entities/legal-hold.entity";
import {
  LegalHoldPage,
  LegalHoldQueryRepositoryPort,
  ListLegalHoldsInput,
} from "@/legal-holds/domain/repositories/legal-hold-query.repository.port";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { LegalHoldDbMapper } from "../mappers/legal-hold.db-mapper";

@Injectable()
export class LegalHoldQueryRepository implements LegalHoldQueryRepositoryPort {
  constructor(private readonly db: DatabaseClient) {}

  async list(input: ListLegalHoldsInput): Promise<LegalHoldPage> {
    const offset = (input.page - 1) * input.limit;

    const [{ count }] = await this.db.connection
      .selectFrom("legal_holds")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .execute();
    const total = Number(count);

    const rows = await this.db.connection
      .selectFrom("legal_holds")
      .selectAll()
      .orderBy("placed_at", "desc")
      .limit(input.limit)
      .offset(offset)
      .execute();

    return {
      data: rows.map((row) => LegalHoldDbMapper.toDomain(row)),
      total,
      page: input.page,
      limit: input.limit,
      lastPage: Math.max(1, Math.ceil(total / input.limit)),
    };
  }

  async findById(id: string): Promise<LegalHold | null> {
    const row = await this.db.connection
      .selectFrom("legal_holds")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? LegalHoldDbMapper.toDomain(row) : null;
  }

  async countAffectedAssets(holdId: string): Promise<number> {
    const row = await this.db.connection
      .selectFrom("legal_hold_assets")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("legal_hold_id", "=", holdId)
      .executeTakeFirstOrThrow();
    return Number((row as { count: string }).count);
  }
}
