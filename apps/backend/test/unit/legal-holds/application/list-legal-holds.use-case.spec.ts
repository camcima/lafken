import { beforeEach, describe, expect, it } from "vitest";

import { ListLegalHoldsUseCase } from "@/legal-holds/application/use-cases/list-legal-holds.use-case";

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
});
