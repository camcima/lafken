import { beforeEach, describe, expect, it } from "vitest";

import { GetNamespaceBySlugUseCase } from "@/namespaces/application/use-cases/get-namespace-by-slug.use-case";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";

import { InMemoryNamespaceQueryRepository } from "../__fakes__/in-memory-namespace-query.repository";

describe("GetNamespaceBySlugUseCase", () => {
  let repository: InMemoryNamespaceQueryRepository;
  let useCase: GetNamespaceBySlugUseCase;

  beforeEach(() => {
    repository = new InMemoryNamespaceQueryRepository();
    useCase = new GetNamespaceBySlugUseCase(repository);
  });

  it("throws NamespaceNotFoundError when the slug does not exist", async () => {
    await expect(useCase.execute({ slug: "missing" })).rejects.toBeInstanceOf(
      NamespaceNotFoundError,
    );
  });

  it("returns the namespace when found", async () => {
    const fixture = Namespace.fromProps({
      id: 1n,
      slug: new Slug("aircraft-photos"),
      displayName: "Aircraft Photos",
      description: null,
      currentPolicyId: 1n,
      storageBindingId: 1n,
      archivedAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    });
    repository.seed([fixture]);

    const result = await useCase.execute({ slug: "aircraft-photos" });
    expect(result.props.slug.value).toBe("aircraft-photos");
  });
});
