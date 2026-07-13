import { Injectable } from "@nestjs/common";
import type { Kysely, Transaction } from "kysely";

import { NamespacePreset } from "@/namespaces/domain/entities/namespace-preset.entity";
import { PresetNameAlreadyExistsError } from "@/namespaces/domain/errors/preset-name-already-exists.error";
import { PresetNotFoundError } from "@/namespaces/domain/errors/preset-not-found.error";
import { PresetVersionConflictError } from "@/namespaces/domain/errors/preset-version-conflict.error";
import type {
  ICreatePresetInput,
  ICreatePresetVersionInput,
  ISetPresetActiveInput,
} from "@/namespaces/domain/repositories/namespace-preset-write.repository.port";
import { NamespacePresetWriteRepositoryPort } from "@/namespaces/domain/repositories/namespace-preset-write.repository.port";
import { ConnectionResolver } from "@/shared/infrastructure/persistence/connection-resolver";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import type { DB } from "@/shared/infrastructure/persistence/db.types";

import { NamespacePresetDbMapper } from "../mappers/namespace-preset.db-mapper";

const PG_UNIQUE_VIOLATION = "23505";

@Injectable()
export class NamespacePresetWriteRepository implements NamespacePresetWriteRepositoryPort {
  constructor(
    private readonly db: DatabaseClient,
    private readonly resolver: ConnectionResolver,
  ) {}

  async createPreset(input: ICreatePresetInput): Promise<NamespacePreset> {
    let row: Record<string, unknown>;
    try {
      row = await this.resolver
        .resolve()
        .insertInto("namespace_presets")
        .values({
          namespace_id: input.namespaceId,
          name: input.name,
          version: 1,
          params: input.params.toJSON(),
          active: true,
          created_by: input.createdBy ?? undefined,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (err) {
      if (this.isPresetVersionUniqueViolation(err)) {
        throw new PresetNameAlreadyExistsError({ slug: "<unknown>", name: input.name });
      }
      throw err;
    }
    return NamespacePresetDbMapper.toDomain(row);
  }

  async createVersion(input: ICreatePresetVersionInput): Promise<NamespacePreset> {
    return this.attemptCreateVersion(input, 0);
  }

  private async attemptCreateVersion(
    input: ICreatePresetVersionInput,
    attempt: number,
  ): Promise<NamespacePreset> {
    const conn = this.resolver.resolve();
    const isAlreadyInTx = conn !== this.db.connection;

    let nextVersion: number = 0;
    try {
      const work = async (tx: Kysely<DB> | Transaction<DB>): Promise<NamespacePreset> => {
        const latest = await tx
          .selectFrom("namespace_presets")
          .select(["version", "active"])
          .where("namespace_id", "=", input.namespaceId)
          .where("name", "=", input.name)
          .orderBy("version", "desc")
          .limit(1)
          .executeTakeFirst();
        if (!latest) {
          throw new PresetNotFoundError({ slug: "<unknown>", name: input.name });
        }
        nextVersion = latest.version + 1;
        const inheritedActive = latest.active;

        const row = await tx
          .insertInto("namespace_presets")
          .values({
            namespace_id: input.namespaceId,
            name: input.name,
            version: nextVersion,
            params: input.params.toJSON(),
            active: inheritedActive,
            created_by: input.createdBy ?? undefined,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        return NamespacePresetDbMapper.toDomain(row);
      };

      if (isAlreadyInTx) {
        return await work(conn);
      }
      return await this.db.connection.transaction().execute(work);
    } catch (err) {
      if (err instanceof PresetNotFoundError) throw err;
      if (this.isPresetVersionUniqueViolation(err)) {
        // Same rule as NamespaceWriteRepository (F-D1): never retry inside an
        // ambient transaction — it is already aborted. The use-case retry
        // loop re-runs in a fresh transaction.
        if (!isAlreadyInTx && attempt < 1) {
          return this.attemptCreateVersion(input, attempt + 1);
        }
        throw new PresetVersionConflictError({
          slug: "<unknown>",
          name: input.name,
          attemptedVersion: nextVersion,
        });
      }
      throw err;
    }
  }

  async setActive(input: ISetPresetActiveInput): Promise<NamespacePreset> {
    const conn = this.resolver.resolve();
    const isAlreadyInTx = conn !== this.db.connection;

    const work = async (tx: Kysely<DB> | Transaction<DB>): Promise<NamespacePreset> => {
      const latest = await tx
        .selectFrom("namespace_presets")
        .select(["id", "version"])
        .where("namespace_id", "=", input.namespaceId)
        .where("name", "=", input.name)
        .orderBy("version", "desc")
        .limit(1)
        .executeTakeFirst();
      if (!latest) {
        throw new PresetNotFoundError({ slug: "<unknown>", name: input.name });
      }
      const row = await tx
        .updateTable("namespace_presets")
        .set({ active: input.active })
        .where("id", "=", latest.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      return NamespacePresetDbMapper.toDomain(row);
    };

    if (isAlreadyInTx) {
      return work(conn);
    }
    return this.db.connection.transaction().execute(work);
  }

  private isPresetVersionUniqueViolation(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const code = (err as { code?: unknown }).code;
    if (code !== PG_UNIQUE_VIOLATION) return false;
    const detail = (err as { detail?: unknown }).detail;
    return typeof detail === "string" && detail.includes("(namespace_id, name, version)");
  }
}
