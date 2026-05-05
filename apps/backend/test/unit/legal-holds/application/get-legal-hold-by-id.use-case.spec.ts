import { beforeEach, describe, expect, it } from "vitest";

import { GetLegalHoldByIdUseCase } from "@/legal-holds/application/use-cases/get-legal-hold-by-id.use-case";
import { LegalHold } from "@/legal-holds/domain/entities/legal-hold.entity";
import { LegalHoldNotFoundError } from "@/legal-holds/domain/errors/legal-hold-not-found.error";

import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryLegalHoldQueryRepository } from "../__fakes__/in-memory-legal-hold-query.repository";

describe("GetLegalHoldByIdUseCase", () => {
  let repository: InMemoryLegalHoldQueryRepository;
  let useCase: GetLegalHoldByIdUseCase;

  beforeEach(() => {
    repository = new InMemoryLegalHoldQueryRepository();
    useCase = new GetLegalHoldByIdUseCase(repository);
  });

  it("throws LegalHoldNotFoundError when the UUID does not match any hold", async () => {
    await expect(
      useCase.execute({ id: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toBeInstanceOf(LegalHoldNotFoundError);
  });

  it("throws LegalHoldNotFoundError for an unknown UUID string", async () => {
    await expect(
      useCase.execute({ id: "01900000-0000-7000-8000-999999999999" }),
    ).rejects.toBeInstanceOf(LegalHoldNotFoundError);
  });

  it("returns the legal hold with affectedAssetCount when found", async () => {
    const fixture = LegalHold.fromProps({
      id: TEST_UUIDS.legalHold1,
      caseReference: "CASE-2026-001",
      description: "Hold for litigation",
      scopeSummary: "All inspection assets",
      placedBy: "legal@example.com",
      placedAt: new Date("2026-01-01T00:00:00Z"),
      liftedBy: null,
      liftedAt: null,
      liftReason: null,
      active: true,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    });
    repository.seed([fixture]);
    repository.seedAssetCount(TEST_UUIDS.legalHold1, 3);

    const result = await useCase.execute({ id: TEST_UUIDS.legalHold1 });
    expect(result.legalHold.props.id).toBe(TEST_UUIDS.legalHold1);
    expect(result.affectedAssetCount).toBe(3);
  });
});
