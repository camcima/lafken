import { beforeEach, describe, expect, it } from "vitest";

import { LiftLegalHoldUseCase } from "@/legal-holds/application/use-cases/lift-legal-hold.use-case";
import { LegalHold } from "@/legal-holds/domain/entities/legal-hold.entity";
import { LegalHoldAlreadyLiftedError } from "@/legal-holds/domain/errors/legal-hold-already-lifted.error";
import { LegalHoldNotFoundError } from "@/legal-holds/domain/errors/legal-hold-not-found.error";

import { FakeLegalHoldQueryRepository } from "../../../__fakes__/fake-legal-hold-query.repository";
import { FakeLegalHoldWriteRepository } from "../../../__fakes__/fake-legal-hold-write.repository";
import { FakeUnitOfWork } from "../../../__fakes__/fake-unit-of-work";
import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryAuditWriteRepository } from "../../audit/__fakes__/in-memory-audit-write.repository";

function makeActiveHold(id: string): LegalHold {
  const now = new Date();
  return LegalHold.fromProps({
    id,
    caseReference: "CHL-AVN-2026-001",
    description: "any",
    scopeSummary: "any",
    placedBy: "ops@example.com",
    placedAt: now,
    liftedBy: null,
    liftedAt: null,
    liftReason: null,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
}

describe("LiftLegalHoldUseCase", () => {
  let queryRepo: FakeLegalHoldQueryRepository;
  let writeRepo: FakeLegalHoldWriteRepository;
  let auditRepo: InMemoryAuditWriteRepository;
  let useCase: LiftLegalHoldUseCase;

  beforeEach(() => {
    queryRepo = new FakeLegalHoldQueryRepository();
    writeRepo = new FakeLegalHoldWriteRepository();
    auditRepo = new InMemoryAuditWriteRepository();
    useCase = new LiftLegalHoldUseCase(queryRepo, writeRepo, auditRepo, new FakeUnitOfWork());
  });

  it("lifts a hold and forwards the covered internal ids to the write repo", async () => {
    queryRepo.holds.set(TEST_UUIDS.legalHold1, makeActiveHold(TEST_UUIDS.legalHold1));
    queryRepo.coveredAssetIdsByHold.set(TEST_UUIDS.legalHold1, ["i-1", "i-2"]);

    const result = await useCase.execute({
      holdId: TEST_UUIDS.legalHold1,
      liftedBy: "legal@example.com",
      liftReason: "Investigation closed.",
      requestIp: null,
    });

    expect(result.props.active).toBe(false);
    expect(result.props.liftedBy).toBe("legal@example.com");
    expect(writeRepo.liftCalls).toHaveLength(1);
    expect(writeRepo.liftCalls[0]?.id).toBe(TEST_UUIDS.legalHold1);
    expect(writeRepo.liftCalls[0]?.assetInternalIds.sort()).toEqual(["i-1", "i-2"].sort());
    expect(auditRepo.records).toHaveLength(1);
    expect(auditRepo.records[0]).toMatchObject({
      entityType: "legal_hold",
      action: "lift",
      occurredBy: "legal@example.com",
      reason: "Investigation closed.",
    });
  });

  it("throws LegalHoldNotFoundError when the hold does not exist", async () => {
    await expect(
      useCase.execute({
        holdId: TEST_UUIDS.legalHold1,
        liftedBy: "legal@example.com",
        liftReason: "any reason ten chars",
        requestIp: null,
      }),
    ).rejects.toBeInstanceOf(LegalHoldNotFoundError);
  });

  it("throws LegalHoldAlreadyLiftedError when active is false", async () => {
    const lifted = LegalHold.fromProps({
      ...makeActiveHold(TEST_UUIDS.legalHold1).props,
      active: false,
      liftedBy: "earlier@example.com",
      liftedAt: new Date(),
      liftReason: "earlier",
    });
    queryRepo.holds.set(TEST_UUIDS.legalHold1, lifted);

    await expect(
      useCase.execute({
        holdId: TEST_UUIDS.legalHold1,
        liftedBy: "legal@example.com",
        liftReason: "any reason ten chars",
        requestIp: null,
      }),
    ).rejects.toBeInstanceOf(LegalHoldAlreadyLiftedError);
  });

  it("forwards an empty internal-ids array when the hold covers no assets (defensive)", async () => {
    queryRepo.holds.set(TEST_UUIDS.legalHold1, makeActiveHold(TEST_UUIDS.legalHold1));
    queryRepo.coveredAssetIdsByHold.set(TEST_UUIDS.legalHold1, []);

    await useCase.execute({
      holdId: TEST_UUIDS.legalHold1,
      liftedBy: "legal@example.com",
      liftReason: "Closure for empty hold.",
      requestIp: null,
    });

    expect(writeRepo.liftCalls[0]?.assetInternalIds).toEqual([]);
  });
});
