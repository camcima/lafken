import { beforeEach, describe, expect, it } from "vitest";

import { GetNamespaceStorageUsageUseCase } from "@/assets/application/use-cases/get-namespace-storage-usage.use-case";
import { Asset } from "@/assets/domain/entities/asset.entity";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";

import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryNamespaceQueryRepository } from "../../namespaces/__fakes__/in-memory-namespace-query.repository";
import { InMemoryAssetQueryRepository } from "../__fakes__/in-memory-asset-query.repository";

function makeNamespace(slug: string, id: string): Namespace {
  return Namespace.fromProps({
    id,
    slug: new Slug(slug),
    displayName: slug,
    description: null,
    currentPolicyId: TEST_UUIDS.policy1,
    storageBindingId: TEST_UUIDS.storageBinding1,
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  });
}

function makeAsset(input: {
  id: string;
  namespaceId: string;
  state: string;
  sizeBytes: bigint | null;
}): Asset {
  return Asset.fromProps({
    id: input.id,
    publicId: input.id,
    namespaceId: input.namespaceId,
    policyVersionId: TEST_UUIDS.policy1,
    storageBindingId: TEST_UUIDS.storageBinding1,
    storageKey: `uploads/${input.id}`,
    state: input.state as Asset["props"]["state"],
    stateReason: null,
    sizeBytes: input.sizeBytes,
    mimeType: null,
    declaredMimeType: null,
    width: null,
    height: null,
    contentHash: null,
    phash: null,
    uploadedBy: null,
    externalRefType: null,
    externalRefId: null,
    customMetadata: {},
    tags: [],
    captureContext: null,
    legalHold: false,
    legalHoldReference: null,
    confirmedAt: null,
    stateChangedAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  });
}

describe("GetNamespaceStorageUsageUseCase", () => {
  let assetQueryRepo: InMemoryAssetQueryRepository;
  let namespaceQueryRepo: InMemoryNamespaceQueryRepository;
  let useCase: GetNamespaceStorageUsageUseCase;

  beforeEach(() => {
    assetQueryRepo = new InMemoryAssetQueryRepository();
    namespaceQueryRepo = new InMemoryNamespaceQueryRepository();
    useCase = new GetNamespaceStorageUsageUseCase(assetQueryRepo, namespaceQueryRepo);
  });

  it("throws NamespaceNotFoundError when the namespace does not exist", async () => {
    await expect(useCase.execute({ namespaceSlug: "missing-ns" })).rejects.toBeInstanceOf(
      NamespaceNotFoundError,
    );
  });

  it("returns zero totals when the namespace has no assets", async () => {
    namespaceQueryRepo.seed([makeNamespace("empty-ns", TEST_UUIDS.namespace1)]);

    const result = await useCase.execute({ namespaceSlug: "empty-ns" });

    expect(result.namespaceSlug).toBe("empty-ns");
    expect(result.totalBytes).toBe(0n);
    expect(result.assetCount).toBe(0);
  });

  it("aggregates uploaded asset sizes", async () => {
    namespaceQueryRepo.seed([makeNamespace("filled-ns", TEST_UUIDS.namespace1)]);
    assetQueryRepo.seed([
      makeAsset({
        id: TEST_UUIDS.asset1,
        namespaceId: TEST_UUIDS.namespace1,
        state: "uploaded",
        sizeBytes: 1024n,
      }),
      makeAsset({
        id: TEST_UUIDS.asset2,
        namespaceId: TEST_UUIDS.namespace1,
        state: "ready",
        sizeBytes: 2048n,
      }),
    ]);

    const result = await useCase.execute({ namespaceSlug: "filled-ns" });

    expect(result.totalBytes).toBe(3072n);
    expect(result.assetCount).toBe(2);
  });

  it("does not count assets from other namespaces", async () => {
    namespaceQueryRepo.seed([
      makeNamespace("target-ns", TEST_UUIDS.namespace1),
      makeNamespace("other-ns", TEST_UUIDS.namespace2),
    ]);
    assetQueryRepo.seed([
      makeAsset({
        id: TEST_UUIDS.asset1,
        namespaceId: TEST_UUIDS.namespace1,
        state: "uploaded",
        sizeBytes: 100n,
      }),
      makeAsset({
        id: TEST_UUIDS.asset2,
        namespaceId: TEST_UUIDS.namespace2,
        state: "uploaded",
        sizeBytes: 9999n,
      }),
    ]);

    const result = await useCase.execute({ namespaceSlug: "target-ns" });

    expect(result.totalBytes).toBe(100n);
    expect(result.assetCount).toBe(1);
  });
});
