import { beforeEach, describe, expect, it } from "vitest";

import { GetStorageBindingByNameUseCase } from "@/system/application/use-cases/get-storage-binding-by-name.use-case";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { StorageBindingNotFoundError } from "@/system/domain/errors/storage-binding-not-found.error";

import { InMemoryStorageBindingQueryRepository } from "../__fakes__/in-memory-storage-binding-query.repository";

describe("GetStorageBindingByNameUseCase", () => {
  let repository: InMemoryStorageBindingQueryRepository;
  let useCase: GetStorageBindingByNameUseCase;

  beforeEach(() => {
    repository = new InMemoryStorageBindingQueryRepository();
    useCase = new GetStorageBindingByNameUseCase(repository);
  });

  it("throws StorageBindingNotFoundError when the name does not exist", async () => {
    await expect(useCase.execute({ name: "missing" })).rejects.toBeInstanceOf(
      StorageBindingNotFoundError,
    );
  });

  it("returns the storage binding when found", async () => {
    const binding = StorageBinding.fromProps({
      id: 1n,
      name: "default",
      adapterType: "gcs",
      config: {},
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    });
    repository.seed([binding]);

    const result = await useCase.execute({ name: "default" });
    expect(result.props.name).toBe("default");
    expect(result.props.adapterType).toBe("gcs");
  });
});
