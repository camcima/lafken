import { beforeEach, describe, expect, it } from "vitest";

import { UpdateStorageBindingUseCase } from "@/system/application/use-cases/update-storage-binding.use-case";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { BucketNotFoundError } from "@/system/domain/errors/bucket-not-found.error";
import { InvalidStorageBindingConfigError } from "@/system/domain/errors/invalid-storage-binding-config.error";
import { StorageBindingNotFoundError } from "@/system/domain/errors/storage-binding-not-found.error";

import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryAuditWriteRepository } from "../../audit/__fakes__/in-memory-audit-write.repository";
import { InMemoryBucketExistsChecker } from "../__fakes__/in-memory-bucket-exists-checker";
import { InMemoryStorageBindingQueryRepository } from "../__fakes__/in-memory-storage-binding-query.repository";
import { InMemoryStorageBindingWriteRepository } from "../__fakes__/in-memory-storage-binding-write.repository";

describe("UpdateStorageBindingUseCase", () => {
  let queryRepository: InMemoryStorageBindingQueryRepository;
  let writeRepository: InMemoryStorageBindingWriteRepository;
  let bucketChecker: InMemoryBucketExistsChecker;
  let auditRepo: InMemoryAuditWriteRepository;
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
    auditRepo = new InMemoryAuditWriteRepository();
    useCase = new UpdateStorageBindingUseCase(
      queryRepository,
      writeRepository,
      bucketChecker,
      auditRepo,
    );

    queryRepository.seed([
      StorageBinding.fromProps({
        id: TEST_UUIDS.storageBinding1,
        name: "default",
        adapterType: "gcs",
        config: originalConfig,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      }),
    ]);
  });

  it("updates the config of an existing binding", async () => {
    const result = await useCase.execute({
      name: "default",
      config: newConfig,
      occurredBy: "ops@latam.com",
    });

    expect(result.props.name).toBe("default");
    expect(result.props.config).toEqual(newConfig);
    expect(result.props.id).toBe(TEST_UUIDS.storageBinding1);
    expect(writeRepository.get("default")?.props.config).toEqual(newConfig);
    expect(auditRepo.records).toHaveLength(1);
    expect(auditRepo.records[0]).toMatchObject({
      entityType: "storage_binding",
      entityId: "default",
      action: "update",
      occurredBy: "ops@latam.com",
    });
  });

  it("rejects when the named binding does not exist", async () => {
    await expect(
      useCase.execute({ name: "missing", config: newConfig, occurredBy: null }),
    ).rejects.toBeInstanceOf(StorageBindingNotFoundError);
  });

  it("rejects when the config does not match the GCS schema and leaves the existing binding unchanged", async () => {
    await expect(
      useCase.execute({
        name: "default",
        config: { bucket: "ab", projectId: "lafken-project" },
        occurredBy: null,
      }),
    ).rejects.toBeInstanceOf(InvalidStorageBindingConfigError);
    expect(writeRepository.size()).toBe(0);
  });

  it("rejects when the new bucket cannot be found and leaves the existing binding unchanged", async () => {
    await expect(
      useCase.execute({
        name: "default",
        config: { bucket: "vanished-bucket", projectId: "lafken-project" },
        occurredBy: null,
      }),
    ).rejects.toBeInstanceOf(BucketNotFoundError);
    expect(writeRepository.size()).toBe(0);
  });
});
