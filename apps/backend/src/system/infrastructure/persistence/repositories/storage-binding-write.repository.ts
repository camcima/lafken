import { Injectable } from "@nestjs/common";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { DuplicateStorageBindingNameError } from "@/system/domain/errors/duplicate-storage-binding-name.error";
import { StorageBindingInUseError } from "@/system/domain/errors/storage-binding-in-use.error";
import { StorageBindingWriteRepositoryPort } from "@/system/domain/repositories/storage-binding-write.repository.port";

import { StorageBindingDbMapper } from "../mappers/storage-binding.db-mapper";

const PG_FK_VIOLATION = "23503";
const PG_UNIQUE_VIOLATION = "23505";

@Injectable()
export class StorageBindingWriteRepository implements StorageBindingWriteRepositoryPort {
  constructor(private readonly db: DatabaseClient) {}

  async insert(binding: StorageBinding): Promise<StorageBinding> {
    let row: Record<string, unknown>;
    try {
      row = await this.db.connection
        .insertInto("storage_bindings")
        .values({
          name: binding.props.name,
          adapter_type: binding.props.adapterType,
          config: binding.props.config,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (err) {
      if (this.isStorageBindingNameUniqueViolation(err)) {
        throw new DuplicateStorageBindingNameError({ name: binding.props.name });
      }
      throw err;
    }

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
    const namespaceCount = await this.countNamespacesUsingBinding(name);
    if (namespaceCount > 0) {
      throw new StorageBindingInUseError({ name, namespaceCount });
    }

    try {
      await this.db.connection.deleteFrom("storage_bindings").where("name", "=", name).execute();
    } catch (err) {
      if (this.isStorageBindingInUseViolation(err)) {
        throw new StorageBindingInUseError({ name, namespaceCount: 0 });
      }
      throw err;
    }
  }

  private async countNamespacesUsingBinding(name: string): Promise<number> {
    const row = await this.db.connection
      .selectFrom("namespaces")
      .innerJoin("storage_bindings", "storage_bindings.id", "namespaces.storage_binding_id")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("storage_bindings.name", "=", name)
      .executeTakeFirst();

    return Number((row as { count?: string } | undefined)?.count ?? 0);
  }

  private isStorageBindingNameUniqueViolation(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const code = (err as { code?: unknown }).code;
    if (code !== PG_UNIQUE_VIOLATION) return false;
    const detail = (err as { detail?: unknown }).detail;
    return typeof detail === "string" && detail.includes("(name)");
  }

  private isStorageBindingInUseViolation(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    if ((err as { code?: unknown }).code === PG_FK_VIOLATION) return true;
    const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
    return message.includes("violates foreign key constraint");
  }
}
