import { beforeEach, describe, expect, it } from "vitest";

import { GetAssetDownloadUrlUseCase } from "@/assets/application/use-cases/get-asset-download-url.use-case";
import { Asset } from "@/assets/domain/entities/asset.entity";
import { AssetNotDownloadableError } from "@/assets/domain/errors/asset-not-downloadable.error";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import type { AssetState } from "@/assets/domain/value-objects/asset-state.value-object";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";

import { FakeAssetStorage } from "../../../__fakes__/fake-asset-storage";
import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryStorageBindingQueryRepository } from "../../system/__fakes__/in-memory-storage-binding-query.repository";
import { InMemoryAssetQueryRepository } from "../__fakes__/in-memory-asset-query.repository";

const DOWNLOADABLE_STATES: AssetState[] = ["uploaded", "processing", "ready"];
const NON_DOWNLOADABLE_STATES: AssetState[] = [
  "pending",
  "rejected",
  "quarantined_virus",
  "quarantined_moderation",
  "quarantined_invalid_format",
  "processing_failed",
  "expired",
  "deleted",
];

function buildAsset(state: AssetState): Asset {
  return Asset.fromProps({
    id: TEST_UUIDS.asset1,
    publicId: "abc-123",
    namespaceId: TEST_UUIDS.namespace1,
    policyVersionId: TEST_UUIDS.policy1,
    storageBindingId: TEST_UUIDS.storageBinding1,
    storageKey: "uploads/abc-123",
    state,
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
}

function buildBinding(): StorageBinding {
  return StorageBinding.fromProps({
    id: TEST_UUIDS.storageBinding1,
    name: "lafken-dev",
    adapterType: "gcs",
    config: { bucket: "lafken-dev", projectId: "fake-project-1" },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  });
}

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
    bindingRepo.seed([buildBinding()]);
  });

  it("returns a signed read URL when the asset and binding exist", async () => {
    assetRepo.seed([buildAsset("ready")]);

    const result = await useCase.execute({ publicId: "abc-123" });

    expect(result.url).toContain(encodeURIComponent("uploads/abc-123"));
    expect(storage.readSigned).toHaveLength(1);
    expect(storage.readSigned[0]).toEqual({
      binding: { bucket: "lafken-dev", projectId: "fake-project-1" },
      storageKey: "uploads/abc-123",
      ttlSeconds: 300,
    });
  });

  it.each(DOWNLOADABLE_STATES)("mints a URL for an asset in state %s", async (state) => {
    assetRepo.seed([buildAsset(state)]);

    const result = await useCase.execute({ publicId: "abc-123" });

    expect(typeof result.url).toBe("string");
  });

  it.each(NON_DOWNLOADABLE_STATES)(
    "throws AssetNotDownloadableError for an asset in state %s",
    async (state) => {
      assetRepo.seed([buildAsset(state)]);

      await expect(useCase.execute({ publicId: "abc-123" })).rejects.toBeInstanceOf(
        AssetNotDownloadableError,
      );
    },
  );

  it.each(NON_DOWNLOADABLE_STATES)(
    "never calls the storage signer for an asset in state %s",
    async (state) => {
      assetRepo.seed([buildAsset(state)]);

      await expect(useCase.execute({ publicId: "abc-123" })).rejects.toThrow();
      expect(storage.readSigned).toHaveLength(0);
    },
  );

  it("throws AssetNotFoundError when the public ID does not match an asset", async () => {
    await expect(useCase.execute({ publicId: "missing" })).rejects.toBeInstanceOf(
      AssetNotFoundError,
    );
  });
});
