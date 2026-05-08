import { beforeEach, describe, expect, it } from "vitest";

import { ArchiveNamespaceUseCase } from "@/namespaces/application/use-cases/archive-namespace.use-case";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";

import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryAuditWriteRepository } from "../../audit/__fakes__/in-memory-audit-write.repository";
import { InMemoryNamespaceQueryRepository } from "../__fakes__/in-memory-namespace-query.repository";
import { InMemoryNamespaceWriteRepository } from "../__fakes__/in-memory-namespace-write.repository";

function makeNamespace(archivedAt: Date | null = null): Namespace {
  return Namespace.fromProps({
    id: TEST_UUIDS.namespace1,
    slug: new Slug("my-namespace"),
    displayName: "My Namespace",
    description: null,
    currentPolicyId: TEST_UUIDS.policy1,
    storageBindingId: TEST_UUIDS.storageBinding1,
    archivedAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("ArchiveNamespaceUseCase", () => {
  let queryRepo: InMemoryNamespaceQueryRepository;
  let writeRepo: InMemoryNamespaceWriteRepository;
  let auditRepo: InMemoryAuditWriteRepository;
  let useCase: ArchiveNamespaceUseCase;

  beforeEach(() => {
    queryRepo = new InMemoryNamespaceQueryRepository();
    writeRepo = new InMemoryNamespaceWriteRepository();
    auditRepo = new InMemoryAuditWriteRepository();
    useCase = new ArchiveNamespaceUseCase(queryRepo, writeRepo, auditRepo);
  });

  it("archives an active namespace and returns it with a non-null archivedAt", async () => {
    const active = makeNamespace(null);
    queryRepo.seed([active]);
    writeRepo.seed(active);

    const result = await useCase.execute({ slug: "my-namespace", occurredBy: "ada@example.com" });

    expect(result.namespace.props.archivedAt).toBeInstanceOf(Date);
    expect(writeRepo.get("my-namespace")?.props.archivedAt).toBeInstanceOf(Date);
    expect(auditRepo.records).toHaveLength(1);
    expect(auditRepo.records[0]).toMatchObject({
      entityType: "namespace",
      entityId: "my-namespace",
      action: "archive",
      occurredBy: "ada@example.com",
    });
  });

  it("returns the existing namespace unchanged when it is already archived (idempotent)", async () => {
    const originalDate = new Date("2024-01-01T00:00:00.000Z");
    const alreadyArchived = makeNamespace(originalDate);
    queryRepo.seed([alreadyArchived]);
    writeRepo.seed(alreadyArchived);

    const result = await useCase.execute({ slug: "my-namespace", occurredBy: "ada@example.com" });

    expect(result.namespace).toBe(alreadyArchived);
    expect(result.namespace.props.archivedAt).toBe(originalDate);
    expect(auditRepo.records).toHaveLength(0);
  });

  it("throws NamespaceNotFoundError when the namespace does not exist", async () => {
    await expect(
      useCase.execute({ slug: "ghost-namespace", occurredBy: null }),
    ).rejects.toBeInstanceOf(NamespaceNotFoundError);
  });
});
