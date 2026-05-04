import { beforeEach, describe, expect, it } from "vitest";

import { UpdateStorageBindingUseCase } from "@/system/application/use-cases/update-storage-binding.use-case";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { BucketNotFoundError } from "@/system/domain/errors/bucket-not-found.error";
import { InvalidStorageBindingConfigError } from "@/system/domain/errors/invalid-storage-binding-config.error";
import { StorageBindingNotFoundError } from "@/system/domain/errors/storage-binding-not-found.error";

import { InMemoryBucketExistsChecker } from "../__fakes__/in-memory-bucket-exists-checker";
import { InMemoryStorageBindingQueryRepository } from "../__fakes__/in-memory-storage-binding-query.repository";
import { InMemoryStorageBindingWriteRepository } from "../__fakes__/in-memory-storage-binding-write.repository";

describe("UpdateStorageBindingUseCase", () => {
  let queryRepository: InMemoryStorageBindingQueryRepository;
  let writeRepository: InMemoryStorageBindingWriteRepository;
  let bucketChecker: InMemoryBucketExistsChecker;
  let useCase: UpdateStorageBindingUseCase;

  const originalConfig = {
    bucket: "lafken-dev",
    projectId: "lafken-project",
  };

  const newConfig = {
    bucket: "lafken-dev",
    projectId: "lafken-project",
    prefix: "tenant-a/",
  };

  beforeEach(() => {
    queryRepository = new InMemoryStorageBindingQueryRepository();
    writeRepository = new InMemoryStorageBindingWriteRepository();
    bucketChecker = new InMemoryBucketExistsChecker();
    bucketChecker.existingBuckets.add("lafken-dev");
    useCase = new UpdateStorageBindingUseCase(queryRepository, writeRepository, bucketChecker);

    queryRepository.seed([
      StorageBinding.fromProps({
        id: 1n,
        name: "default",
        adapterType: "gcs",
        config: originalConfig,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      }),
    ]);
  });

  it("updates the config of an existing binding", async () => {
    const result = await useCase.execute({ name: "default", config: newConfig });

    expect(result.props.name).toBe("default");
    expect(result.props.config).toEqual(newConfig);
    expect(result.props.id).toBe(1n);
    expect(writeRepository.get("default")?.props.config).toEqual(newConfig);
  });

  it("rejects when the named binding does not exist", async () => {
    await expect(useCase.execute({ name: "missing", config: newConfig })).rejects.toBeInstanceOf(
      StorageBindingNotFoundError,
    );
  });

  it("rejects when the config does not match the GCS schema and leaves the existing binding unchanged", async () => {
    await expect(
      useCase.execute({
        name: "default",
        config: { bucket: "ab", projectId: "lafken-project" },
      }),
    ).rejects.toBeInstanceOf(InvalidStorageBindingConfigError);
    expect(writeRepository.size()).toBe(0);
  });

  it("rejects when the new bucket cannot be found and leaves the existing binding unchanged", async () => {
    await expect(
      useCase.execute({
        name: "default",
        config: { bucket: "vanished-bucket", projectId: "lafken-project" },
      }),
    ).rejects.toBeInstanceOf(BucketNotFoundError);
    expect(writeRepository.size()).toBe(0);
  });
});
