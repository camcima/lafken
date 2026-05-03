import { beforeEach, describe, expect, it } from "vitest";

import { GetLegalHoldByIdUseCase } from "@/legal-holds/application/use-cases/get-legal-hold-by-id.use-case";
import { LegalHold } from "@/legal-holds/domain/entities/legal-hold.entity";
import { LegalHoldNotFoundError } from "@/legal-holds/domain/errors/legal-hold-not-found.error";

import { InMemoryLegalHoldQueryRepository } from "../__fakes__/in-memory-legal-hold-query.repository";

describe("GetLegalHoldByIdUseCase", () => {
  let repository: InMemoryLegalHoldQueryRepository;
  let useCase: GetLegalHoldByIdUseCase;

  beforeEach(() => {
    repository = new InMemoryLegalHoldQueryRepository();
    useCase = new GetLegalHoldByIdUseCase(repository);
  });

  it("throws LegalHoldNotFoundError when the id does not exist", async () => {
    await expect(useCase.execute({ id: "99999" })).rejects.toBeInstanceOf(LegalHoldNotFoundError);
  });

  it("throws LegalHoldNotFoundError for an invalid (non-numeric) id", async () => {
    await expect(useCase.execute({ id: "not-a-number" })).rejects.toBeInstanceOf(
      LegalHoldNotFoundError,
    );
  });

  it("returns the legal hold with affectedAssetCount when found", async () => {
    const fixture = LegalHold.fromProps({
      id: 1n,
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
    repository.seedAssetCount(1n, 3);

    const result = await useCase.execute({ id: "1" });
    expect(result.legalHold.props.id).toBe(1n);
    expect(result.affectedAssetCount).toBe(3);
  });
});
