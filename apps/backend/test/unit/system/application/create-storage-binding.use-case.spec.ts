import { beforeEach, describe, expect, it } from "vitest";

import { CreateStorageBindingUseCase } from "@/system/application/use-cases/create-storage-binding.use-case";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { BucketNotFoundError } from "@/system/domain/errors/bucket-not-found.error";
import { DuplicateStorageBindingNameError } from "@/system/domain/errors/duplicate-storage-binding-name.error";
import { InvalidStorageBindingConfigError } from "@/system/domain/errors/invalid-storage-binding-config.error";
import { InvalidStorageBindingNameError } from "@/system/domain/errors/invalid-storage-binding-name.error";

import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryBucketExistsChecker } from "../__fakes__/in-memory-bucket-exists-checker";
import { InMemoryStorageBindingQueryRepository } from "../__fakes__/in-memory-storage-binding-query.repository";
import { InMemoryStorageBindingWriteRepository } from "../__fakes__/in-memory-storage-binding-write.repository";

describe("CreateStorageBindingUseCase", () => {
  let queryRepository: InMemoryStorageBindingQueryRepository;
  let writeRepository: InMemoryStorageBindingWriteRepository;
  let bucketChecker: InMemoryBucketExistsChecker;
  let useCase: CreateStorageBindingUseCase;

  const validConfig = {
    bucket: "lafken-dev",
    projectId: "lafken-project",
  };

  beforeEach(() => {
    queryRepository = new InMemoryStorageBindingQueryRepository();
    writeRepository = new InMemoryStorageBindingWriteRepository();
    bucketChecker = new InMemoryBucketExistsChecker();
    bucketChecker.existingBuckets.add("lafken-dev");
    useCase = new CreateStorageBindingUseCase(queryRepository, writeRepository, bucketChecker);
  });

  it("persists a new storage binding and assigns a positive id", async () => {
    const result = await useCase.execute({
      name: "default",
      adapterType: "gcs",
      config: validConfig,
    });

    expect(result.props.name).toBe("default");
    expect(result.props.adapterType).toBe("gcs");
    expect(result.props.config).toEqual(validConfig);
    expect(typeof result.props.id).toBe("string");
    expect(result.props.id.length).toBeGreaterThan(0);
    expect(writeRepository.has("default")).toBe(true);
  });

  it("rejects when a binding with the same name already exists", async () => {
    queryRepository.seed([
      StorageBinding.fromProps({
        id: TEST_UUIDS.storageBinding1,
        name: "default",
        adapterType: "gcs",
        config: validConfig,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      }),
    ]);

    await expect(
      useCase.execute({ name: "default", adapterType: "gcs", config: validConfig }),
    ).rejects.toBeInstanceOf(DuplicateStorageBindingNameError);
    expect(writeRepository.size()).toBe(0);
  });

  it("rejects when the bucket cannot be found in the backend", async () => {
    await expect(
      useCase.execute({
        name: "default",
        adapterType: "gcs",
        config: { bucket: "missing-bucket", projectId: "lafken-project" },
      }),
    ).rejects.toBeInstanceOf(BucketNotFoundError);
    expect(writeRepository.size()).toBe(0);
  });

  it("rejects when the config does not match the GCS schema", async () => {
    await expect(
      useCase.execute({
        name: "default",
        adapterType: "gcs",
        config: { bucket: "ab", projectId: "lafken-project" },
      }),
    ).rejects.toBeInstanceOf(InvalidStorageBindingConfigError);
    expect(writeRepository.size()).toBe(0);
  });

  it("rejects when the binding name does not match the required pattern", async () => {
    await expect(
      useCase.execute({
        name: "INVALID NAME",
        adapterType: "gcs",
        config: validConfig,
      }),
    ).rejects.toBeInstanceOf(InvalidStorageBindingNameError);
    expect(writeRepository.size()).toBe(0);
  });
});
