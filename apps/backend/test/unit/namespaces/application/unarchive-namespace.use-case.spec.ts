import { beforeEach, describe, expect, it } from "vitest";

import { UnarchiveNamespaceUseCase } from "@/namespaces/application/use-cases/unarchive-namespace.use-case";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";

import { InMemoryNamespaceQueryRepository } from "../__fakes__/in-memory-namespace-query.repository";
import { InMemoryNamespaceWriteRepository } from "../__fakes__/in-memory-namespace-write.repository";

function makeNamespace(archivedAt: Date | null): Namespace {
  return Namespace.fromProps({
    id: 1n,
    slug: new Slug("my-namespace"),
    displayName: "My Namespace",
    description: null,
    currentPolicyId: 1n,
    storageBindingId: 1n,
    archivedAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("UnarchiveNamespaceUseCase", () => {
  let queryRepo: InMemoryNamespaceQueryRepository;
  let writeRepo: InMemoryNamespaceWriteRepository;
  let useCase: UnarchiveNamespaceUseCase;

  beforeEach(() => {
    queryRepo = new InMemoryNamespaceQueryRepository();
    writeRepo = new InMemoryNamespaceWriteRepository();
    useCase = new UnarchiveNamespaceUseCase(queryRepo, writeRepo);
  });

  it("unarchives an archived namespace and returns it with archivedAt === null", async () => {
    const archived = makeNamespace(new Date("2024-01-01T00:00:00.000Z"));
    queryRepo.seed([archived]);
    writeRepo.seed(archived);

    const result = await useCase.execute({ slug: "my-namespace" });

    expect(result.props.archivedAt).toBeNull();
    expect(writeRepo.get("my-namespace")?.props.archivedAt).toBeNull();
  });

  it("returns the existing namespace unchanged when it is already active (idempotent)", async () => {
    const active = makeNamespace(null);
    queryRepo.seed([active]);
    writeRepo.seed(active);

    const result = await useCase.execute({ slug: "my-namespace" });

    expect(result).toBe(active);
    expect(result.props.archivedAt).toBeNull();
  });

  it("throws NamespaceNotFoundError when the namespace does not exist", async () => {
    await expect(useCase.execute({ slug: "ghost-namespace" })).rejects.toBeInstanceOf(
      NamespaceNotFoundError,
    );
  });
});
