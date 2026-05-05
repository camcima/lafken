import { Injectable } from "@nestjs/common";

import { NamespacePolicy } from "@/namespaces/domain/entities/namespace-policy.entity";
import { NamespacePreset } from "@/namespaces/domain/entities/namespace-preset.entity";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import {
  ListNamespacesInput,
  NamespacePage,
  NamespaceQueryRepositoryPort,
} from "@/namespaces/domain/repositories/namespace-query.repository.port";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { NamespacePolicyDbMapper } from "../mappers/namespace-policy.db-mapper";
import { NamespacePresetDbMapper } from "../mappers/namespace-preset.db-mapper";
import { NamespaceDbMapper } from "../mappers/namespace.db-mapper";

@Injectable()
export class NamespaceQueryRepository implements NamespaceQueryRepositoryPort {
  constructor(private readonly db: DatabaseClient) {}

  async list(input: ListNamespacesInput): Promise<NamespacePage> {
    const offset = (input.page - 1) * input.limit;

    const [{ count }] = await this.db.connection
      .selectFrom("namespaces")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .execute();
    const total = Number(count);

    const rows = await this.db.connection
      .selectFrom("namespaces")
      .selectAll()
      .orderBy("created_at", "desc")
      .limit(input.limit)
      .offset(offset)
      .execute();

    return {
      data: rows.map((row) => NamespaceDbMapper.toDomain(row)),
      total,
      page: input.page,
      limit: input.limit,
      lastPage: Math.max(1, Math.ceil(total / input.limit)),
    };
  }

  async findBySlug(slug: string): Promise<Namespace | null> {
    const row = await this.db.connection
      .selectFrom("namespaces")
      .selectAll()
      .where("slug", "=", slug)
      .executeTakeFirst();
    return row ? NamespaceDbMapper.toDomain(row) : null;
  }

  async listPolicies(namespaceId: string): Promise<NamespacePolicy[]> {
    const rows = await this.db.connection
      .selectFrom("namespace_policies")
      .selectAll()
      .where("namespace_id", "=", namespaceId)
      .orderBy("version", "desc")
      .execute();
    return rows.map((row) => NamespacePolicyDbMapper.toDomain(row));
  }

  async listPresets(namespaceId: string): Promise<NamespacePreset[]> {
    const rows = await this.db.connection
      .selectFrom("namespace_presets")
      .selectAll()
      .where("namespace_id", "=", namespaceId)
      .where("active", "=", true)
      .orderBy("name", "asc")
      .orderBy("version", "desc")
      .execute();
    return rows.map((row) => NamespacePresetDbMapper.toDomain(row));
  }

  async findPresetByName(_namespaceId: string, _name: string): Promise<NamespacePreset | null> {
    throw new Error("Not implemented yet — Task 4");
  }

  async findStorageBindingName(storageBindingId: string): Promise<string | null> {
    const row = await this.db.connection
      .selectFrom("storage_bindings")
      .select("name")
      .where("id", "=", storageBindingId)
      .executeTakeFirst();
    return (row as { name?: string } | undefined)?.name ?? null;
  }

  async findCurrentPolicyVersion(namespaceId: string): Promise<number | null> {
    const row = await this.db.connection
      .selectFrom("namespaces as n")
      .innerJoin("namespace_policies as p", "p.id", "n.current_policy_id")
      .select("p.version")
      .where("n.id", "=", namespaceId)
      .executeTakeFirst();
    return (row as { version?: number } | undefined)?.version ?? null;
  }
}
