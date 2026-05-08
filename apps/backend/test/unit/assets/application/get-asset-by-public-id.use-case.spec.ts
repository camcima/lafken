import { beforeEach, describe, expect, it } from "vitest";

import { GetAssetByPublicIdUseCase } from "@/assets/application/use-cases/get-asset-by-public-id.use-case";
import { Asset } from "@/assets/domain/entities/asset.entity";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";

import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryAssetQueryRepository } from "../__fakes__/in-memory-asset-query.repository";

describe("GetAssetByPublicIdUseCase", () => {
  let repository: InMemoryAssetQueryRepository;
  let useCase: GetAssetByPublicIdUseCase;

  beforeEach(() => {
    repository = new InMemoryAssetQueryRepository();
    useCase = new GetAssetByPublicIdUseCase(repository);
  });

  it("throws AssetNotFoundError when the public ID does not exist", async () => {
    await expect(useCase.execute({ publicId: "missing-id" })).rejects.toBeInstanceOf(
      AssetNotFoundError,
    );
  });

  it("returns the asset with metadata when found", async () => {
    const fixture = Asset.fromProps({
      id: TEST_UUIDS.asset1,
      publicId: "abc-123",
      namespaceId: TEST_UUIDS.namespace1,
      policyVersionId: TEST_UUIDS.policy1,
      storageBindingId: TEST_UUIDS.storageBinding1,
      storageKey: "uploads/abc-123",
      state: "ready",
      stateReason: null,
      sizeBytes: null,
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
      captureContext: null,
      tags: [],
      legalHold: false,
      legalHoldReference: null,
      confirmedAt: null,
      stateChangedAt: new Date("2026-01-01T00:00:00Z"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    });
    repository.seed([fixture]);
    repository.seedNamespaceSlug(TEST_UUIDS.namespace1, "aircraft-photos");
    repository.seedPolicyVersion(TEST_UUIDS.policy1, 3);

    const result = await useCase.execute({ publicId: "abc-123" });
    expect(result.asset.props.publicId).toBe("abc-123");
    expect(result.namespaceSlug).toBe("aircraft-photos");
    expect(result.policyVersion).toBe(3);
  });
});
