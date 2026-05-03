import { beforeEach, describe, expect, it } from "vitest";

import { ListAssetsUseCase } from "@/assets/application/use-cases/list-assets.use-case";

import { InMemoryAssetQueryRepository } from "../__fakes__/in-memory-asset-query.repository";

describe("ListAssetsUseCase", () => {
  let repository: InMemoryAssetQueryRepository;
  let useCase: ListAssetsUseCase;

  beforeEach(() => {
    repository = new InMemoryAssetQueryRepository();
    useCase = new ListAssetsUseCase(repository);
  });

  it("returns an empty page when there are no assets", async () => {
    const result = await useCase.execute({ page: 1, limit: 20 });
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.lastPage).toBe(1);
  });
});
