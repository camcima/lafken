import { beforeEach, describe, expect, it } from "vitest";

import { ListQuarantinedAssetsUseCase } from "@/quarantine/application/use-cases/list-quarantined-assets.use-case";

import { InMemoryQuarantineQueryRepository } from "../__fakes__/in-memory-quarantine-query.repository";

describe("ListQuarantinedAssetsUseCase", () => {
  let repository: InMemoryQuarantineQueryRepository;
  let useCase: ListQuarantinedAssetsUseCase;

  beforeEach(() => {
    repository = new InMemoryQuarantineQueryRepository();
    useCase = new ListQuarantinedAssetsUseCase(repository);
  });

  it("returns an empty page when there are no quarantined assets", async () => {
    const result = await useCase.execute({ page: 1, limit: 20 });
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.lastPage).toBe(1);
  });
});
