import { beforeEach, describe, expect, it } from "vitest";

import { ListLegalHoldsUseCase } from "@/legal-holds/application/use-cases/list-legal-holds.use-case";
import { LegalHold } from "@/legal-holds/domain/entities/legal-hold.entity";

import { InMemoryLegalHoldQueryRepository } from "../__fakes__/in-memory-legal-hold-query.repository";

describe("ListLegalHoldsUseCase", () => {
  let repository: InMemoryLegalHoldQueryRepository;
  let useCase: ListLegalHoldsUseCase;

  beforeEach(() => {
    repository = new InMemoryLegalHoldQueryRepository();
    useCase = new ListLegalHoldsUseCase(repository);
  });

  it("returns an empty page when there are no legal holds", async () => {
    const result = await useCase.execute({ page: 1, limit: 20 });
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.lastPage).toBe(1);
  });

  it("returns enriched holds with their affectedAssetCount", async () => {
    const holdId = 1n;
    const legalHold = LegalHold.fromProps({
      id: holdId,
      caseReference: "CASE-001",
      description: "Test legal hold",
      scopeSummary: "All assets in namespace X",
      placedBy: "admin@example.com",
      placedAt: new Date("2025-01-15T10:00:00.000Z"),
      liftedBy: null,
      liftedAt: null,
      liftReason: null,
      active: true,
      createdAt: new Date("2025-01-15T10:00:00.000Z"),
      updatedAt: new Date("2025-01-15T10:00:00.000Z"),
    });

    repository.seed([legalHold]);
    repository.seedAssetCount(holdId, 42);

    const result = await useCase.execute({ page: 1, limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].affectedAssetCount).toBe(42);
    expect(result.data[0].legalHold.props.id).toBe(holdId);
  });
});
