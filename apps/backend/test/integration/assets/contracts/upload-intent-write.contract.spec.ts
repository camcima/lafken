import { randomUUID } from "node:crypto";

import { describe } from "vitest";

import type { IInsertUploadIntentInput } from "@/assets/domain/repositories/upload-intent-write.repository.port";
import { UploadIntentWriteRepository } from "@/assets/infrastructure/persistence/repositories/upload-intent-write.repository";

import { FakeUploadIntentWriteRepository } from "../../../__fakes__/fake-upload-intent-write.repository";
import { setupIntegrationDb } from "../../helpers/integration-db";
import {
  type IUploadIntentWriteContractContext,
  runUploadIntentWriteContract,
} from "./upload-intent-write.contract";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const HOUR_MS = 3_600_000;

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
  runUploadIntentWriteContract(() => {
    const repo = new FakeUploadIntentWriteRepository();
    return Promise.resolve<IUploadIntentWriteContractContext>({
      repo,
      makeInsertInput: makeInputFactory({
        namespaceId: NIL_UUID,
        policyVersionId: NIL_UUID,
        storageBindingId: NIL_UUID,
      }),
      consumeForTest: (publicId) => {
        repo.consumeSeeded(publicId, new Date());
        return Promise.resolve();
      },
    });
  });
});

describe("UploadIntentWriteRepositoryPort contract — Postgres repository", () => {
  // Shared FK-ordered cleanup + namespace/policy/binding seeding helper — see
  // CLAUDE.md: never hand-roll a delete order or duplicate seeding in a spec.
  const dbCtx = setupIntegrationDb();

  runUploadIntentWriteContract(async (): Promise<IUploadIntentWriteContractContext> => {
    await dbCtx.cleanCommonTables();
    const seeded = await dbCtx.seedNamespaceWithPolicyAndBinding();

    return {
      repo: new UploadIntentWriteRepository(dbCtx.db),
      makeInsertInput: makeInputFactory({
        namespaceId: seeded.namespaceId,
        policyVersionId: seeded.policyVersionId,
        storageBindingId: seeded.bindingId,
      }),
      // Test-only bypass of the port (see IUploadIntentWriteContractContext
      // doc comment) — direct SQL, not the repository under test.
      consumeForTest: async (publicId: string): Promise<void> => {
        await dbCtx.db.connection
          .updateTable("upload_intents")
          .set({ consumed_at: new Date() })
          .where("public_id", "=", publicId)
          .execute();
      },
    };
  });
});
