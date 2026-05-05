import { beforeEach, describe, expect, it } from "vitest";

import { UpdateNamespaceMetadataUseCase } from "@/namespaces/application/use-cases/update-namespace-metadata.use-case";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";

import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryNamespaceQueryRepository } from "../__fakes__/in-memory-namespace-query.repository";
import { InMemoryNamespaceWriteRepository } from "../__fakes__/in-memory-namespace-write.repository";

function makeNamespace(overrides: Partial<{ slug: string; displayName: string }> = {}): Namespace {
  return Namespace.fromProps({
    id: TEST_UUIDS.namespace1,
    slug: new Slug(overrides.slug ?? "my-namespace"),
    displayName: overrides.displayName ?? "My Namespace",
    description: null,
    currentPolicyId: TEST_UUIDS.policy1,
    storageBindingId: TEST_UUIDS.storageBinding1,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("UpdateNamespaceMetadataUseCase", () => {
  let queryRepo: InMemoryNamespaceQueryRepository;
  let writeRepo: InMemoryNamespaceWriteRepository;
  let useCase: UpdateNamespaceMetadataUseCase;

  beforeEach(() => {
    queryRepo = new InMemoryNamespaceQueryRepository();
    writeRepo = new InMemoryNamespaceWriteRepository();
    useCase = new UpdateNamespaceMetadataUseCase(queryRepo, writeRepo);
  });

  it("updates metadata and returns the updated namespace when the namespace exists", async () => {
    const existing = makeNamespace({ slug: "my-namespace", displayName: "Old Name" });
    queryRepo.seed([existing]);
    writeRepo.seed(existing);

    const result = await useCase.execute({
      slug: "my-namespace",
      displayName: "New Name",
      description: "A fresh description",
    });

    expect(result.namespace.props.displayName).toBe("New Name");
    expect(result.namespace.props.description).toBe("A fresh description");
    expect(writeRepo.get("my-namespace")?.props.displayName).toBe("New Name");
  });

  it("throws NamespaceNotFoundError and does not write when the namespace does not exist", async () => {
    await expect(
      useCase.execute({
        slug: "ghost-namespace",
        displayName: "Whatever",
        description: null,
      }),
    ).rejects.toBeInstanceOf(NamespaceNotFoundError);
    expect(writeRepo.size()).toBe(0);
  });
});
