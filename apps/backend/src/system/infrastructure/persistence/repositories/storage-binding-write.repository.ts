import { Injectable } from "@nestjs/common";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { StorageBindingWriteRepositoryPort } from "@/system/domain/repositories/storage-binding-write.repository.port";

import { StorageBindingDbMapper } from "../mappers/storage-binding.db-mapper";

@Injectable()
export class StorageBindingWriteRepository implements StorageBindingWriteRepositoryPort {
  constructor(private readonly db: DatabaseClient) {}

  async insert(binding: StorageBinding): Promise<StorageBinding> {
    const row = await this.db.connection
      .insertInto("storage_bindings")
      .values({
        name: binding.props.name,
        adapter_type: binding.props.adapterType,
        config: binding.props.config,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return StorageBindingDbMapper.toDomain(row);
  }

  async update(binding: StorageBinding): Promise<StorageBinding> {
    const row = await this.db.connection
      .updateTable("storage_bindings")
      .set({
        adapter_type: binding.props.adapterType,
        config: binding.props.config,
      })
      .where("name", "=", binding.props.name)
      .returningAll()
      .executeTakeFirstOrThrow();

    return StorageBindingDbMapper.toDomain(row);
  }

  async delete(name: string): Promise<void> {
    await this.db.connection.deleteFrom("storage_bindings").where("name", "=", name).execute();
  }
}
