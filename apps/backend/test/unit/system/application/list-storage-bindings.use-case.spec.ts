import { beforeEach, describe, expect, it } from "vitest";

import { ListStorageBindingsUseCase } from "@/system/application/use-cases/list-storage-bindings.use-case";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";

import { InMemoryStorageBindingQueryRepository } from "../__fakes__/in-memory-storage-binding-query.repository";

describe("ListStorageBindingsUseCase", () => {
  let repository: InMemoryStorageBindingQueryRepository;
  let useCase: ListStorageBindingsUseCase;

  beforeEach(() => {
    repository = new InMemoryStorageBindingQueryRepository();
    useCase = new ListStorageBindingsUseCase(repository);
  });

  it("returns an empty list when there are no storage bindings", async () => {
    const result = await useCase.execute();
    expect(result).toEqual([]);
  });

  it("returns all storage bindings when they exist", async () => {
    const binding = StorageBinding.fromProps({
      id: 1n,
      name: "default",
      adapterType: "gcs",
      config: {},
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    });
    repository.seed([binding]);

    const result = await useCase.execute();
    expect(result).toHaveLength(1);
    expect(result[0].props.name).toBe("default");
  });
});
