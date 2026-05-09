import { describe, expect, it } from "vitest";

import { OrphanUploadIntentSweeperUseCase } from "@/assets/application/processing/orphan-upload-intent-sweeper.use-case";

import { InMemoryAssetQueryRepository } from "../__fakes__/in-memory-asset-query.repository";
import {
  buildAuditWriteRepoStub,
  buildBindingRepoStub,
  buildIntentRepoStub,
  buildStorageStub,
} from "./helpers/orphan-sweeper-stubs";

describe("OrphanUploadIntentSweeperUseCase", () => {
  it("marks each orphan expired, deletes bytes best-effort, and audits expired", async () => {
    const intents = buildIntentRepoStub({
      orphans: [
        { publicId: "p1", storageBindingId: "b1", storageKey: "k1" },
        { publicId: "p2", storageBindingId: "b1", storageKey: "k2" },
      ],
    });
    const storage = buildStorageStub();
    const audit = buildAuditWriteRepoStub();
    const useCase = new OrphanUploadIntentSweeperUseCase(
      intents,
      buildBindingRepoStub(),
      storage,
      audit,
      new InMemoryAssetQueryRepository(),
    );

    await useCase.execute({ now: new Date(), graceMs: 300_000, batchSize: 50 });

    expect(intents.markExpiredCalls.map((c) => c.publicId)).toEqual(["p1", "p2"]);
    expect(storage.deleteCalls.map((c) => c.storageKey)).toEqual(["k1", "k2"]);
    expect(audit.calls).toHaveLength(2);
    expect(audit.calls[0].action).toBe("expired");
  });

  it("ignores storage 'not found' errors", async () => {
    const intents = buildIntentRepoStub({
      orphans: [{ publicId: "p1", storageBindingId: "b1", storageKey: "k1" }],
    });
    const storage = buildStorageStub({ throwOnDelete: new Error("not found") });
    const audit = buildAuditWriteRepoStub();
    const useCase = new OrphanUploadIntentSweeperUseCase(
      intents,
      buildBindingRepoStub(),
      storage,
      audit,
      new InMemoryAssetQueryRepository(),
    );
    await expect(
      useCase.execute({ now: new Date(), graceMs: 300_000, batchSize: 50 }),
    ).resolves.toBeUndefined();
    expect(intents.markExpiredCalls.map((c) => c.publicId)).toEqual(["p1"]);
  });

  it("skips audit + delete when markExpired returns false (lost race)", async () => {
    const intents = buildIntentRepoStub({
      orphans: [{ publicId: "p1", storageBindingId: "b1", storageKey: "k1" }],
      markExpiredReturns: false,
    });
    const storage = buildStorageStub();
    const audit = buildAuditWriteRepoStub();
    const useCase = new OrphanUploadIntentSweeperUseCase(
      intents,
      buildBindingRepoStub(),
      storage,
      audit,
      new InMemoryAssetQueryRepository(),
    );
    await useCase.execute({ now: new Date(), graceMs: 300_000, batchSize: 50 });
    expect(storage.deleteCalls).toHaveLength(0);
    expect(audit.calls).toHaveLength(0);
  });
});
