import { beforeEach, describe, expect, it } from "vitest";

import { UpdateNamespacePolicyUseCase } from "@/namespaces/application/use-cases/update-namespace-policy.use-case";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { NamespaceArchivedError } from "@/namespaces/domain/errors/namespace-archived.error";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { PolicyVersionConflictError } from "@/namespaces/domain/errors/policy-version-conflict.error";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";

import { InMemoryNamespaceQueryRepository } from "../__fakes__/in-memory-namespace-query.repository";
import { InMemoryNamespaceWriteRepository } from "../__fakes__/in-memory-namespace-write.repository";

const VALID_POLICY = {
  retentionDays: null,
  retentionMode: "none" as const,
  maxFileSizeBytes: 52_428_800n,
  allowedMimeTypes: ["image/jpeg"],
  exifHandling: "strip" as const,
  virusScanRequired: true,
  contentModeration: null,
  requiredMetadataSchema: null,
  immutable: false,
  servingMode: "signed" as const,
  signedUrlTtlSeconds: 3600,
  signedUrlBucketSize: 300,
  retryConfig: null,
};

function makeNamespace(opts: { slug: string; archived?: boolean }): Namespace {
  return Namespace.fromProps({
    id: 42n,
    slug: new Slug(opts.slug),
    displayName: "X",
    description: null,
    currentPolicyId: 1n,
    storageBindingId: 1n,
    archivedAt: opts.archived ? new Date() : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("UpdateNamespacePolicyUseCase", () => {
  let queryRepo: InMemoryNamespaceQueryRepository;
  let writeRepo: InMemoryNamespaceWriteRepository;
  let useCase: UpdateNamespacePolicyUseCase;

  beforeEach(() => {
    queryRepo = new InMemoryNamespaceQueryRepository();
    writeRepo = new InMemoryNamespaceWriteRepository();
    useCase = new UpdateNamespacePolicyUseCase(queryRepo, writeRepo);
  });

  it("creates a new policy version on an active namespace and returns the result", async () => {
    const ns = makeNamespace({ slug: "aircraft-photos" });
    queryRepo.seed([ns]);
    writeRepo.seed(ns);

    const result = await useCase.execute({
      slug: "aircraft-photos",
      policy: VALID_POLICY,
      createdBy: "ops@latam.com",
    });

    expect(result.newPolicyVersion).toBe(1);
    expect(result.namespace.props.slug.value).toBe("aircraft-photos");
  });

  it("throws NamespaceNotFoundError when slug is not present", async () => {
    await expect(
      useCase.execute({ slug: "ghost", policy: VALID_POLICY, createdBy: null }),
    ).rejects.toBeInstanceOf(NamespaceNotFoundError);
  });

  it("throws NamespaceArchivedError when namespace is archived", async () => {
    const ns = makeNamespace({ slug: "aircraft-photos", archived: true });
    queryRepo.seed([ns]);
    writeRepo.seed(ns);

    await expect(
      useCase.execute({ slug: "aircraft-photos", policy: VALID_POLICY, createdBy: null }),
    ).rejects.toBeInstanceOf(NamespaceArchivedError);
  });

  it("retries once on a transient version conflict and succeeds", async () => {
    const ns = makeNamespace({ slug: "aircraft-photos" });
    queryRepo.seed([ns]);
    writeRepo.seed(ns);
    writeRepo.collisionsRemaining = 1;

    const result = await useCase.execute({
      slug: "aircraft-photos",
      policy: VALID_POLICY,
      createdBy: null,
    });

    expect(result.newPolicyVersion).toBe(1);
    expect(writeRepo.collisionsRemaining).toBe(0);
  });

  it("surfaces PolicyVersionConflictError on a persistent conflict", async () => {
    const ns = makeNamespace({ slug: "aircraft-photos" });
    queryRepo.seed([ns]);
    writeRepo.seed(ns);
    writeRepo.collisionsRemaining = 5;

    await expect(
      useCase.execute({ slug: "aircraft-photos", policy: VALID_POLICY, createdBy: null }),
    ).rejects.toBeInstanceOf(PolicyVersionConflictError);
  });
});
