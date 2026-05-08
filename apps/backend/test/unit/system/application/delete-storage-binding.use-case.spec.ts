import { beforeEach, describe, expect, it } from "vitest";

import { DeleteStorageBindingUseCase } from "@/system/application/use-cases/delete-storage-binding.use-case";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { StorageBindingNotFoundError } from "@/system/domain/errors/storage-binding-not-found.error";

import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryAuditWriteRepository } from "../../audit/__fakes__/in-memory-audit-write.repository";
import { InMemoryStorageBindingQueryRepository } from "../__fakes__/in-memory-storage-binding-query.repository";
import { InMemoryStorageBindingWriteRepository } from "../__fakes__/in-memory-storage-binding-write.repository";

describe("DeleteStorageBindingUseCase", () => {
  let queryRepository: InMemoryStorageBindingQueryRepository;
  let writeRepository: InMemoryStorageBindingWriteRepository;
  let auditRepo: InMemoryAuditWriteRepository;
  let useCase: DeleteStorageBindingUseCase;

  beforeEach(() => {
    queryRepository = new InMemoryStorageBindingQueryRepository();
    writeRepository = new InMemoryStorageBindingWriteRepository();
    auditRepo = new InMemoryAuditWriteRepository();
    useCase = new DeleteStorageBindingUseCase(queryRepository, writeRepository, auditRepo);
  });

  it("deletes a storage binding when it exists", async () => {
    const binding = StorageBinding.fromProps({
      id: TEST_UUIDS.storageBinding1,
      name: "default",
      adapterType: "gcs",
      config: { bucket: "lafken-dev", projectId: "lafken-project" },
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    });
    queryRepository.seed([binding]);
    writeRepository.seed(binding);

    await useCase.execute({ name: "default", occurredBy: "ops@latam.com" });

    expect(writeRepository.has("default")).toBe(false);
    expect(auditRepo.records).toHaveLength(1);
    expect(auditRepo.records[0]).toMatchObject({
      entityType: "storage_binding",
      entityId: "default",
      action: "delete",
      occurredBy: "ops@latam.com",
    });
  });

  it("rejects when the binding does not exist", async () => {
    await expect(useCase.execute({ name: "missing", occurredBy: null })).rejects.toBeInstanceOf(
      StorageBindingNotFoundError,
    );
    expect(auditRepo.records).toHaveLength(0);
  });
});
