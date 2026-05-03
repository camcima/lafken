import { beforeEach, describe, expect, it } from "vitest";

import { ListAuditEntriesUseCase } from "@/audit/application/use-cases/list-audit-entries.use-case";

import { InMemoryAuditQueryRepository } from "../__fakes__/in-memory-audit-query.repository";

describe("ListAuditEntriesUseCase", () => {
  let repository: InMemoryAuditQueryRepository;
  let useCase: ListAuditEntriesUseCase;

  beforeEach(() => {
    repository = new InMemoryAuditQueryRepository();
    useCase = new ListAuditEntriesUseCase(repository);
  });

  it("returns an empty page when there are no audit entries", async () => {
    const result = await useCase.execute({ page: 1, limit: 20 });
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.lastPage).toBe(1);
  });
});
