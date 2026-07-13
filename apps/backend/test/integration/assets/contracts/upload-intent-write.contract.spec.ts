import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe } from "vitest";

import type { IInsertUploadIntentInput } from "@/assets/domain/repositories/upload-intent-write.repository.port";
import { UploadIntentWriteRepository } from "@/assets/infrastructure/persistence/repositories/upload-intent-write.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { FakeUploadIntentWriteRepository } from "../../../__fakes__/fake-upload-intent-write.repository";
import { cleanDatabase } from "../../helpers/clean-database";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";
import {
  type IUploadIntentWriteContractContext,
  runUploadIntentWriteContract,
} from "./upload-intent-write.contract";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const HOUR_MS = 3_600_000;

const VALID_DB_POLICY_VALUES = {
  retention_days: null,
  retention_mode: "none",
  max_file_size_bytes: 52_428_800n,
  allowed_mime_types: ["image/jpeg"],
  exif_handling: "strip",
  virus_scan_required: false,
  content_moderation: null,
  required_metadata_schema: null,
  immutable: false,
  serving_mode: "signed",
  signed_url_ttl_seconds: 3600,
  signed_url_bucket_size: 300,
  retry_config: null,
  created_by: null,
};

function makeInputFactory(ids: {
  namespaceId: string;
  policyVersionId: string;
  storageBindingId: string;
}): (overrides?: Partial<IInsertUploadIntentInput>) => IInsertUploadIntentInput {
  return (overrides = {}) => {
    const publicId = overrides.publicId ?? randomUUID();
    return {
      publicId,
      namespaceId: ids.namespaceId,
      policyVersionId: ids.policyVersionId,
      storageBindingId: ids.storageBindingId,
      storageKey: `contract/${publicId}/source`,
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: 1024n,
      uploadUrl: "https://storage.example.com/signed",
      uploadUrlExpiresAt: new Date(Date.now() + HOUR_MS),
      createdBy: "ops@latam.com",
      ...overrides,
    };
  };
}

describe("UploadIntentWriteRepositoryPort contract — in-memory fake", () => {
  runUploadIntentWriteContract(() =>
    Promise.resolve<IUploadIntentWriteContractContext>({
      repo: new FakeUploadIntentWriteRepository(),
      makeInsertInput: makeInputFactory({
        namespaceId: NIL_UUID,
        policyVersionId: NIL_UUID,
        storageBindingId: NIL_UUID,
      }),
    }),
  );
});

describe("UploadIntentWriteRepositoryPort contract — Postgres repository", () => {
  let db: DatabaseClient;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  runUploadIntentWriteContract(async (): Promise<IUploadIntentWriteContractContext> => {
    // Shared FK-ordered cleanup helper — see CLAUDE.md: never hand-roll a
    // delete order in a spec, it's a source of FK-RESTRICT flakes.
    await cleanDatabase(db);

    const sb = await db.connection
      .insertInto("storage_bindings")
      .values({ name: "contract-binding", adapter_type: "gcs", config: { bucket: "lafken-dev" } })
      .returning("id")
      .executeTakeFirstOrThrow();

    const seeded = await db.connection.transaction().execute(async (tx) => {
      const ns = await tx
        .insertInto("namespaces")
        .values({
          slug: "contract-ns",
          display_name: "Contract NS",
          description: null,
          current_policy_id: NIL_UUID,
          storage_binding_id: sb.id,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      const policy = await tx
        .insertInto("namespace_policies")
        .values({ namespace_id: ns.id, version: 1, ...VALID_DB_POLICY_VALUES })
        .returning("id")
        .executeTakeFirstOrThrow();

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: policy.id })
        .where("id", "=", ns.id)
        .execute();

      return { namespaceId: ns.id, policyVersionId: policy.id };
    });

    return {
      repo: new UploadIntentWriteRepository(db),
      makeInsertInput: makeInputFactory({
        namespaceId: seeded.namespaceId,
        policyVersionId: seeded.policyVersionId,
        storageBindingId: sb.id,
      }),
    };
  });
});
