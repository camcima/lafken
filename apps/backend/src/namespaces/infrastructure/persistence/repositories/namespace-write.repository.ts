import { Injectable } from "@nestjs/common";
import type { Kysely, Transaction } from "kysely";

import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { NamespaceAlreadyExistsError } from "@/namespaces/domain/errors/namespace-already-exists.error";
import { PolicyVersionConflictError } from "@/namespaces/domain/errors/policy-version-conflict.error";
import { StorageBindingMissingError } from "@/namespaces/domain/errors/storage-binding-missing.error";
import type {
  ICreatePolicyVersionInput,
  ICreatePolicyVersionResult,
} from "@/namespaces/domain/repositories/namespace-write.repository.port";
import {
  ICreateNamespaceInput,
  IUpdateNamespaceMetadataInput,
  NamespaceWriteRepositoryPort,
} from "@/namespaces/domain/repositories/namespace-write.repository.port";
import { ConnectionResolver } from "@/shared/infrastructure/persistence/connection-resolver";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import type { DB } from "@/shared/infrastructure/persistence/db.types";
import { NIL_UUID } from "@/shared/kernel/domain/nil-uuid.constant";

import { NamespaceDbMapper } from "../mappers/namespace.db-mapper";

const PG_FK_VIOLATION = "23503";
const STORAGE_BINDING_FK_HINT = "storage_binding_id";
const PG_UNIQUE_VIOLATION = "23505";

@Injectable()
export class NamespaceWriteRepository implements NamespaceWriteRepositoryPort {
  constructor(
    private readonly db: DatabaseClient,
    private readonly resolver: ConnectionResolver,
  ) {}

  async createWithInitialPolicy(input: ICreateNamespaceInput): Promise<Namespace> {
    const conn = this.resolver.resolve();
    const isAlreadyInTx = conn !== this.db.connection;

    const work = async (tx: Kysely<DB> | Transaction<DB>): Promise<Namespace> => {
      try {
        // namespaces.current_policy_id FK is DEFERRABLE INITIALLY DEFERRED —
        // the check is deferred to commit, so we can insert the namespace first
        // with NIL_UUID as a placeholder, then insert the policy with the real
        // namespace_id, then backfill current_policy_id before the tx commits.
        const nsRow = await tx
          .insertInto("namespaces")
          .values({
            slug: input.slug,
            display_name: input.displayName,
            description: input.description ?? null,
            current_policy_id: NIL_UUID,
            storage_binding_id: input.storageBindingId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        const namespaceId = (nsRow as { id: string }).id;

        const policyRow = await tx
          .insertInto("namespace_policies")
          .values({
            namespace_id: namespaceId,
            version: 1,
            retention_days: input.policy.retentionDays ?? undefined,
            retention_mode: input.policy.retentionMode,
            max_file_size_bytes: input.policy.maxFileSizeBytes,
            allowed_mime_types: input.policy.allowedMimeTypes,
            exif_handling: input.policy.exifHandling,
            virus_scan_required: input.policy.virusScanRequired,
            content_moderation: input.policy.contentModeration ?? undefined,
            required_metadata_schema: input.policy.requiredMetadataSchema ?? undefined,
            immutable: input.policy.immutable,
            serving_mode: input.policy.servingMode,
            signed_url_ttl_seconds: input.policy.signedUrlTtlSeconds ?? undefined,
            signed_url_bucket_size: input.policy.signedUrlBucketSize ?? undefined,
            retry_config: input.policy.retryConfig ?? undefined,
            created_by: input.createdBy ?? undefined,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        const policyId = (policyRow as { id: string }).id;

        const updatedNsRow = await tx
          .updateTable("namespaces")
          .set({ current_policy_id: policyId })
          .where("id", "=", namespaceId)
          .returningAll()
          .executeTakeFirstOrThrow();

        return NamespaceDbMapper.toDomain(updatedNsRow);
      } catch (err) {
        if (this.isStorageBindingFkViolation(err)) {
          throw new StorageBindingMissingError({ storageBindingId: input.storageBindingId });
        }
        if (this.isNamespaceSlugUniqueViolation(err)) {
          throw new NamespaceAlreadyExistsError({ slug: input.slug });
        }
        throw err;
      }
    };

    if (isAlreadyInTx) {
      return work(conn);
    }
    return this.db.connection.transaction().execute(work);
  }

  async updateMetadata(input: IUpdateNamespaceMetadataInput): Promise<Namespace> {
    const row = await this.resolver
      .resolve()
      .updateTable("namespaces")
      .set({
        display_name: input.displayName,
        description: input.description,
      })
      .where("slug", "=", input.slug)
      .returningAll()
      .executeTakeFirstOrThrow();

    return NamespaceDbMapper.toDomain(row);
  }

  async archive(slug: string): Promise<Namespace> {
    const row = await this.resolver
      .resolve()
      .updateTable("namespaces")
      .set({ archived_at: new Date() })
      .where("slug", "=", slug)
      .returningAll()
      .executeTakeFirstOrThrow();

    return NamespaceDbMapper.toDomain(row);
  }

  async unarchive(slug: string): Promise<Namespace> {
    const row = await this.resolver
      .resolve()
      .updateTable("namespaces")
      .set({ archived_at: null })
      .where("slug", "=", slug)
      .returningAll()
      .executeTakeFirstOrThrow();

    return NamespaceDbMapper.toDomain(row);
  }

  async createPolicyVersion(input: ICreatePolicyVersionInput): Promise<ICreatePolicyVersionResult> {
    return this.attemptCreatePolicyVersion(input, 0);
  }

  private async attemptCreatePolicyVersion(
    input: ICreatePolicyVersionInput,
    attempt: number,
  ): Promise<ICreatePolicyVersionResult> {
    const conn = this.resolver.resolve();
    const isAlreadyInTx = conn !== this.db.connection;

    let nextVersion: number = 0;
    try {
      const work = async (
        tx: Kysely<DB> | Transaction<DB>,
      ): Promise<ICreatePolicyVersionResult> => {
        const maxRow = await tx
          .selectFrom("namespace_policies")
          .select((eb) => eb.fn.max<number>("version").as("max"))
          .where("namespace_id", "=", input.namespaceId)
          .executeTakeFirstOrThrow();
        nextVersion = ((maxRow as { max: number | null }).max ?? 0) + 1;

        const policyRow = await tx
          .insertInto("namespace_policies")
          .values({
            namespace_id: input.namespaceId,
            version: nextVersion,
            retention_days: input.policy.retentionDays ?? undefined,
            retention_mode: input.policy.retentionMode,
            max_file_size_bytes: input.policy.maxFileSizeBytes,
            allowed_mime_types: input.policy.allowedMimeTypes,
            exif_handling: input.policy.exifHandling,
            virus_scan_required: input.policy.virusScanRequired,
            content_moderation: input.policy.contentModeration ?? undefined,
            required_metadata_schema: input.policy.requiredMetadataSchema ?? undefined,
            immutable: input.policy.immutable,
            serving_mode: input.policy.servingMode,
            signed_url_ttl_seconds: input.policy.signedUrlTtlSeconds ?? undefined,
            signed_url_bucket_size: input.policy.signedUrlBucketSize ?? undefined,
            retry_config: input.policy.retryConfig ?? undefined,
            created_by: input.createdBy ?? undefined,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        const policyId = (policyRow as { id: string }).id;

        const nsRow = await tx
          .updateTable("namespaces")
          .set({ current_policy_id: policyId })
          .where("id", "=", input.namespaceId)
          .returningAll()
          .executeTakeFirstOrThrow();

        return {
          namespace: NamespaceDbMapper.toDomain(nsRow),
          newPolicyVersion: nextVersion,
        };
      };

      if (isAlreadyInTx) {
        return await work(conn);
      }
      return await this.db.connection.transaction().execute(work);
    } catch (err) {
      if (this.isPolicyVersionUniqueViolation(err)) {
        // Inside an ambient UoW the surrounding transaction is already
        // aborted (any further statement fails with 25P02) — retrying here
        // would run on the aborted connection. Translate immediately and let
        // the use-case retry loop re-run in a fresh transaction.
        if (!isAlreadyInTx && attempt < 1) {
          return this.attemptCreatePolicyVersion(input, attempt + 1);
        }
        throw new PolicyVersionConflictError({ slug: "<unknown>", attemptedVersion: nextVersion });
      }
      throw err;
    }
  }

  private isPolicyVersionUniqueViolation(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const code = (err as { code?: unknown }).code;
    if (code !== PG_UNIQUE_VIOLATION) return false;
    const detail = (err as { detail?: unknown }).detail;
    return typeof detail === "string" && detail.includes("(namespace_id, version)");
  }

  private isNamespaceSlugUniqueViolation(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const code = (err as { code?: unknown }).code;
    if (code !== PG_UNIQUE_VIOLATION) return false;
    const detail = (err as { detail?: unknown }).detail;
    return typeof detail === "string" && detail.includes("(slug)");
  }

  private isStorageBindingFkViolation(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const code = (err as { code?: unknown }).code;
    const detail = (err as { detail?: unknown }).detail;
    return (
      code === PG_FK_VIOLATION &&
      typeof detail === "string" &&
      detail.includes(STORAGE_BINDING_FK_HINT)
    );
  }
}
