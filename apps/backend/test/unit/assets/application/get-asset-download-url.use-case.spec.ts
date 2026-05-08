import { beforeEach, describe, expect, it } from "vitest";

import { GetAssetDownloadUrlUseCase } from "@/assets/application/use-cases/get-asset-download-url.use-case";
import { Asset } from "@/assets/domain/entities/asset.entity";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";

import { FakeAssetStorage } from "../../../__fakes__/fake-asset-storage";
import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryStorageBindingQueryRepository } from "../../system/__fakes__/in-memory-storage-binding-query.repository";
import { InMemoryAssetQueryRepository } from "../__fakes__/in-memory-asset-query.repository";

describe("GetAssetDownloadUrlUseCase", () => {
  let assetRepo: InMemoryAssetQueryRepository;
  let bindingRepo: InMemoryStorageBindingQueryRepository;
  let storage: FakeAssetStorage;
  let useCase: GetAssetDownloadUrlUseCase;

  beforeEach(() => {
    assetRepo = new InMemoryAssetQueryRepository();
    bindingRepo = new InMemoryStorageBindingQueryRepository();
    storage = new FakeAssetStorage();
    useCase = new GetAssetDownloadUrlUseCase(assetRepo, bindingRepo, storage);
  });

  it("returns a signed read URL when the asset and binding exist", async () => {
    const asset = Asset.fromProps({
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
    assetRepo.seed([asset]);

    const binding = StorageBinding.fromProps({
      id: TEST_UUIDS.storageBinding1,
      name: "lafken-dev",
      adapterType: "gcs",
      config: { bucket: "lafken-dev", projectId: "fake-project-1" },
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    });
    bindingRepo.seed([binding]);

    const result = await useCase.execute({ publicId: "abc-123" });

    expect(result.url).toContain(encodeURIComponent("uploads/abc-123"));
    expect(storage.readSigned).toHaveLength(1);
    expect(storage.readSigned[0]).toEqual({
      binding: { bucket: "lafken-dev", projectId: "fake-project-1" },
      storageKey: "uploads/abc-123",
      ttlSeconds: 300,
    });
  });

  it("throws AssetNotFoundError when the public ID does not match an asset", async () => {
    await expect(useCase.execute({ publicId: "missing" })).rejects.toBeInstanceOf(
      AssetNotFoundError,
    );
  });
});
