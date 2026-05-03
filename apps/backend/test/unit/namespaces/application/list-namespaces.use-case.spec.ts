import { beforeEach, describe, expect, it } from "vitest";

import { ListNamespacesUseCase } from "@/namespaces/application/use-cases/list-namespaces.use-case";

import { InMemoryNamespaceQueryRepository } from "../__fakes__/in-memory-namespace-query.repository";

describe("ListNamespacesUseCase", () => {
  let repository: InMemoryNamespaceQueryRepository;
  let useCase: ListNamespacesUseCase;

  beforeEach(() => {
    repository = new InMemoryNamespaceQueryRepository();
    useCase = new ListNamespacesUseCase(repository);
  });

  it("returns an empty page when there are no namespaces", async () => {
    const result = await useCase.execute({ page: 1, limit: 20 });
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.lastPage).toBe(1);
  });
});
