import { Injectable } from "@nestjs/common";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

import { StorageBindingDbMapper } from "../mappers/storage-binding.db-mapper";

@Injectable()
export class StorageBindingQueryRepository implements StorageBindingQueryRepositoryPort {
  constructor(private readonly db: DatabaseClient) {}

  async list(): Promise<StorageBinding[]> {
    const rows = await this.db.connection
      .selectFrom("storage_bindings")
      .selectAll()
      .orderBy("name", "asc")
      .execute();

    return rows.map((row) => StorageBindingDbMapper.toDomain(row));
  }

  async findByName(name: string): Promise<StorageBinding | null> {
    const row = await this.db.connection
      .selectFrom("storage_bindings")
      .selectAll()
      .where("name", "=", name)
      .executeTakeFirst();

    return row ? StorageBindingDbMapper.toDomain(row) : null;
  }
}
