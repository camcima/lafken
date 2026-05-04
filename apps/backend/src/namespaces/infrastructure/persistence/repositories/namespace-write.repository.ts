import { Injectable } from "@nestjs/common";

import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
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
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { NamespaceDbMapper } from "../mappers/namespace.db-mapper";

const PG_FK_VIOLATION = "23503";
const STORAGE_BINDING_FK_HINT = "storage_binding_id";

@Injectable()
export class NamespaceWriteRepository implements NamespaceWriteRepositoryPort {
  constructor(private readonly db: DatabaseClient) {}

  async createWithInitialPolicy(input: ICreateNamespaceInput): Promise<Namespace> {
    return this.db.connection.transaction().execute(async (tx) => {
      try {
        // namespaces.current_policy_id FK is DEFERRABLE INITIALLY DEFERRED —
        // the check is deferred to commit, so we can insert the namespace first
        // with a placeholder 0n value, then insert the policy with the real
        // namespace_id, then backfill current_policy_id before the tx commits.
        const nsRow = await tx
          .insertInto("namespaces")
          .values({
            slug: input.slug,
            display_name: input.displayName,
            description: input.description ?? null,
            current_policy_id: BigInt(0),
            storage_binding_id: input.storageBindingId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        const namespaceId = BigInt((nsRow as { id: bigint }).id);

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

        const policyId = BigInt((policyRow as { id: bigint }).id);

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
        throw err;
      }
    });
  }

  async updateMetadata(input: IUpdateNamespaceMetadataInput): Promise<Namespace> {
    const row = await this.db.connection
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
    const row = await this.db.connection
      .updateTable("namespaces")
      .set({ archived_at: new Date() })
      .where("slug", "=", slug)
      .returningAll()
      .executeTakeFirstOrThrow();

    return NamespaceDbMapper.toDomain(row);
  }

  async unarchive(slug: string): Promise<Namespace> {
    const row = await this.db.connection
      .updateTable("namespaces")
      .set({ archived_at: null })
      .where("slug", "=", slug)
      .returningAll()
      .executeTakeFirstOrThrow();

    return NamespaceDbMapper.toDomain(row);
  }

  createPolicyVersion(_input: ICreatePolicyVersionInput): Promise<ICreatePolicyVersionResult> {
    return Promise.reject(new Error("Not implemented yet — Task 3"));
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
