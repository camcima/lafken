import { beforeEach, describe, expect, it } from "vitest";

import { CreateNamespaceUseCase } from "@/namespaces/application/use-cases/create-namespace.use-case";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { InvalidSlugError } from "@/namespaces/domain/errors/invalid-slug.error";
import { NamespaceAlreadyExistsError } from "@/namespaces/domain/errors/namespace-already-exists.error";
import { StorageBindingMissingError } from "@/namespaces/domain/errors/storage-binding-missing.error";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";

import { FakeUnitOfWork } from "../../../__fakes__/fake-unit-of-work";
import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryAuditWriteRepository } from "../../audit/__fakes__/in-memory-audit-write.repository";
import { InMemoryNamespaceQueryRepository } from "../__fakes__/in-memory-namespace-query.repository";
import { InMemoryNamespaceWriteRepository } from "../__fakes__/in-memory-namespace-write.repository";

const VALID_INPUT = {
  slug: "aircraft-photos",
  displayName: "Aircraft photos",
  description: "Photos of aircraft.",
  storageBindingId: TEST_UUIDS.storageBinding1,
  policy: {
    retentionDays: null,
    retentionMode: "none" as const,
    maxFileSizeBytes: 52_428_800n,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    exifHandling: "strip" as const,
    virusScanRequired: true,
    contentModeration: null,
    requiredMetadataSchema: null,
    immutable: false,
    servingMode: "signed" as const,
    signedUrlTtlSeconds: 3600,
    signedUrlBucketSize: 300,
    retryConfig: null,
  },
  createdBy: "ops@latam.com",
  requestIp: null,
};

describe("CreateNamespaceUseCase", () => {
  let queryRepo: InMemoryNamespaceQueryRepository;
  let writeRepo: InMemoryNamespaceWriteRepository;
  let auditRepo: InMemoryAuditWriteRepository;
  let useCase: CreateNamespaceUseCase;

  beforeEach(() => {
    queryRepo = new InMemoryNamespaceQueryRepository();
    writeRepo = new InMemoryNamespaceWriteRepository();
    auditRepo = new InMemoryAuditWriteRepository();
    useCase = new CreateNamespaceUseCase(queryRepo, writeRepo, auditRepo, new FakeUnitOfWork());
  });

  it("creates a namespace and returns it when the slug is unique and binding exists", async () => {
    const result = await useCase.execute(VALID_INPUT);
    expect(result.namespace.props.slug.value).toBe("aircraft-photos");
    expect(writeRepo.has("aircraft-photos")).toBe(true);
    expect(auditRepo.records).toHaveLength(1);
    expect(auditRepo.records[0]).toMatchObject({
      entityType: "namespace",
      entityId: "aircraft-photos",
      action: "create",
      occurredBy: "ops@latam.com",
    });
  });

  it("throws NamespaceAlreadyExistsError when the slug is taken", async () => {
    queryRepo.seed([
      Namespace.fromProps({
        id: TEST_UUIDS.namespace1,
        slug: new Slug("aircraft-photos"),
        displayName: "x",
        description: null,
        currentPolicyId: TEST_UUIDS.policy1,
        storageBindingId: TEST_UUIDS.storageBinding1,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ]);
    await expect(useCase.execute(VALID_INPUT)).rejects.toBeInstanceOf(NamespaceAlreadyExistsError);
    expect(writeRepo.size()).toBe(0);
  });

  it("throws InvalidSlugError when the slug is invalid", async () => {
    await expect(useCase.execute({ ...VALID_INPUT, slug: "Bad Slug!" })).rejects.toBeInstanceOf(
      InvalidSlugError,
    );
    expect(writeRepo.size()).toBe(0);
  });

  it("throws StorageBindingMissingError when the binding does not exist", async () => {
    writeRepo.missingStorageBindings.add(VALID_INPUT.storageBindingId);
    await expect(useCase.execute(VALID_INPUT)).rejects.toBeInstanceOf(StorageBindingMissingError);
    expect(writeRepo.size()).toBe(0);
  });
});
