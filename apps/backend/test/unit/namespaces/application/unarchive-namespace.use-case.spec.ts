import { beforeEach, describe, expect, it } from "vitest";

import { UnarchiveNamespaceUseCase } from "@/namespaces/application/use-cases/unarchive-namespace.use-case";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";

import { FakeUnitOfWork } from "../../../__fakes__/fake-unit-of-work";
import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryAuditWriteRepository } from "../../audit/__fakes__/in-memory-audit-write.repository";
import { InMemoryNamespaceQueryRepository } from "../__fakes__/in-memory-namespace-query.repository";
import { InMemoryNamespaceWriteRepository } from "../__fakes__/in-memory-namespace-write.repository";

function makeNamespace(archivedAt: Date | null): Namespace {
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

describe("UnarchiveNamespaceUseCase", () => {
  let queryRepo: InMemoryNamespaceQueryRepository;
  let writeRepo: InMemoryNamespaceWriteRepository;
  let auditRepo: InMemoryAuditWriteRepository;
  let useCase: UnarchiveNamespaceUseCase;

  beforeEach(() => {
    queryRepo = new InMemoryNamespaceQueryRepository();
    writeRepo = new InMemoryNamespaceWriteRepository();
    auditRepo = new InMemoryAuditWriteRepository();
    useCase = new UnarchiveNamespaceUseCase(queryRepo, writeRepo, auditRepo, new FakeUnitOfWork());
  });

  it("unarchives an archived namespace and returns it with archivedAt === null", async () => {
    const archived = makeNamespace(new Date("2024-01-01T00:00:00.000Z"));
    queryRepo.seed([archived]);
    writeRepo.seed(archived);

    const result = await useCase.execute({
      slug: "my-namespace",
      occurredBy: "ada@example.com",
      requestIp: null,
    });

    expect(result.namespace.props.archivedAt).toBeNull();
    expect(writeRepo.get("my-namespace")?.props.archivedAt).toBeNull();
    expect(auditRepo.records).toHaveLength(1);
    expect(auditRepo.records[0]).toMatchObject({
      entityType: "namespace",
      entityId: "my-namespace",
      action: "unarchive",
      occurredBy: "ada@example.com",
    });
  });

  it("returns the existing namespace unchanged when it is already active (idempotent)", async () => {
    const active = makeNamespace(null);
    queryRepo.seed([active]);
    writeRepo.seed(active);

    const result = await useCase.execute({
      slug: "my-namespace",
      occurredBy: "ada@example.com",
      requestIp: null,
    });

    expect(result.namespace).toBe(active);
    expect(result.namespace.props.archivedAt).toBeNull();
    expect(auditRepo.records).toHaveLength(0);
  });

  it("throws NamespaceNotFoundError when the namespace does not exist", async () => {
    await expect(
      useCase.execute({ slug: "ghost-namespace", occurredBy: null, requestIp: null }),
    ).rejects.toBeInstanceOf(NamespaceNotFoundError);
  });
});
