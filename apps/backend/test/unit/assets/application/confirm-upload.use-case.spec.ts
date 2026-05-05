import { beforeEach, describe, expect, it } from "vitest";

import { ConfirmUploadUseCase } from "@/assets/application/use-cases/confirm-upload.use-case";
import { Asset } from "@/assets/domain/entities/asset.entity";
import { UploadIntent } from "@/assets/domain/entities/upload-intent.entity";
import { UploadIntentExpiredError } from "@/assets/domain/errors/upload-intent-expired.error";
import { UploadIntentNotFoundError } from "@/assets/domain/errors/upload-intent-not-found.error";
import { UploadedObjectMissingError } from "@/assets/domain/errors/uploaded-object-missing.error";
import { NamespacePolicy } from "@/namespaces/domain/entities/namespace-policy.entity";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";

import { FakeAssetStorage } from "../../../__fakes__/fake-asset-storage";
import { FakeAssetWriteRepository } from "../../../__fakes__/fake-asset-write.repository";
import { FakeUploadIntentWriteRepository } from "../../../__fakes__/fake-upload-intent-write.repository";
import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryAssetQueryRepository } from "../../assets/__fakes__/in-memory-asset-query.repository";
import { InMemoryNamespaceQueryRepository } from "../../namespaces/__fakes__/in-memory-namespace-query.repository";
import { InMemoryStorageBindingQueryRepository } from "../../system/__fakes__/in-memory-storage-binding-query.repository";

const FUTURE = new Date(Date.now() + 1_800_000);
const PAST = new Date(Date.now() - 1_000);

function makeIntent(
  overrides: Partial<{
    publicId: string;
    consumedAt: Date | null;
    uploadUrlExpiresAt: Date;
  }> = {},
): UploadIntent {
  return UploadIntent.fromProps({
    id: "intent-id-1",
    publicId: overrides.publicId ?? TEST_UUIDS.asset1,
    namespaceId: TEST_UUIDS.namespace1,
    policyVersionId: TEST_UUIDS.policy1,
    storageBindingId: TEST_UUIDS.storageBinding1,
    storageKey: `aircraft-photos/assets/${TEST_UUIDS.asset1}/source`,
    declaredMimeType: "image/jpeg",
    declaredSizeBytes: 1_048_576n,
    uploadUrl: "https://fake-gcs.local/upload/stub",
    uploadUrlExpiresAt: overrides.uploadUrlExpiresAt ?? FUTURE,
    createdBy: null,
    consumedAt: overrides.consumedAt ?? null,
    expiredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makePolicy(): NamespacePolicy {
  return NamespacePolicy.fromProps({
    id: TEST_UUIDS.policy1,
    namespaceId: TEST_UUIDS.namespace1,
    version: 1,
    retentionDays: null,
    retentionMode: "none",
    maxFileSizeBytes: 10_485_760n,
    allowedMimeTypes: ["image/jpeg"],
    exifHandling: "strip",
    virusScanRequired: false,
    contentModeration: null,
    requiredMetadataSchema: null,
    immutable: false,
    servingMode: "signed",
    signedUrlTtlSeconds: 3600,
    signedUrlBucketSize: null,
    retryConfig: null,
    createdBy: null,
    createdAt: new Date(),
  });
}

function makeBinding(): StorageBinding {
  return StorageBinding.fromProps({
    id: TEST_UUIDS.storageBinding1,
    name: "primary-gcs",
    adapterType: "gcs",
    config: { bucket: "test-bucket", projectId: "test-project" },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeAsset(publicId: string): Asset {
  const now = new Date();
  return Asset.fromProps({
    id: "asset-id-1",
    publicId,
    namespaceId: TEST_UUIDS.namespace1,
    policyVersionId: TEST_UUIDS.policy1,
    storageBindingId: TEST_UUIDS.storageBinding1,
    storageKey: `aircraft-photos/assets/${publicId}/source`,
    state: "uploaded",
    stateReason: null,
    sizeBytes: 1_048_576n,
    mimeType: null,
    declaredMimeType: "image/jpeg",
    width: null,
    height: null,
    contentHash: null,
    uploadedBy: null,
    owningRecordType: null,
    owningRecordId: null,
    customMetadata: {},
    captureContext: null,
    legalHold: false,
    confirmedAt: now,
    stateChangedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

describe("ConfirmUploadUseCase", () => {
  let intentRepo: FakeUploadIntentWriteRepository;
  let assetWriteRepo: FakeAssetWriteRepository;
  let assetStorage: FakeAssetStorage;
  let namespaceQueryRepo: InMemoryNamespaceQueryRepository;
  let storageBindingQueryRepo: InMemoryStorageBindingQueryRepository;
  let assetQueryRepo: InMemoryAssetQueryRepository;
  let useCase: ConfirmUploadUseCase;

  beforeEach(() => {
    intentRepo = new FakeUploadIntentWriteRepository();
    assetWriteRepo = new FakeAssetWriteRepository();
    assetStorage = new FakeAssetStorage();
    namespaceQueryRepo = new InMemoryNamespaceQueryRepository();
    storageBindingQueryRepo = new InMemoryStorageBindingQueryRepository();
    assetQueryRepo = new InMemoryAssetQueryRepository();
    useCase = new ConfirmUploadUseCase(
      intentRepo,
      assetWriteRepo,
      assetStorage,
      namespaceQueryRepo,
      storageBindingQueryRepo,
      assetQueryRepo,
    );
  });

  it("confirms a valid upload and returns a new Asset", async () => {
    const intent = makeIntent();
    intentRepo.seed([intent]);
    storageBindingQueryRepo.seed([makeBinding()]);
    namespaceQueryRepo.seedPolicies(TEST_UUIDS.namespace1, [makePolicy()]);

    const asset = await useCase.execute({
      publicId: TEST_UUIDS.asset1,
      uploadedBy: "user@example.com",
    });

    expect(asset.props.publicId).toBe(TEST_UUIDS.asset1);
    expect(asset.props.state).toBe("uploaded");
    expect(assetWriteRepo.createdAssets).toHaveLength(1);
    expect(assetStorage.existsCalls).toHaveLength(1);
  });

  it("throws UploadIntentNotFoundError when no intent exists for the publicId", async () => {
    await expect(
      useCase.execute({ publicId: "nonexistent-id", uploadedBy: null }),
    ).rejects.toBeInstanceOf(UploadIntentNotFoundError);
  });

  it("returns the existing Asset idempotently when the intent is already consumed", async () => {
    const publicId = TEST_UUIDS.asset1;
    const consumedIntent = makeIntent({ consumedAt: new Date() });
    const existingAsset = makeAsset(publicId);
    intentRepo.seed([consumedIntent]);
    assetQueryRepo.seed([existingAsset]);

    const result = await useCase.execute({ publicId, uploadedBy: null });

    expect(result.props.publicId).toBe(publicId);
    expect(assetWriteRepo.createdAssets).toHaveLength(0);
  });

  it("throws UploadIntentExpiredError when the upload URL has passed its expiry", async () => {
    const expiredIntent = makeIntent({ uploadUrlExpiresAt: PAST });
    intentRepo.seed([expiredIntent]);
    storageBindingQueryRepo.seed([makeBinding()]);

    await expect(
      useCase.execute({ publicId: TEST_UUIDS.asset1, uploadedBy: null }),
    ).rejects.toBeInstanceOf(UploadIntentExpiredError);
  });

  it("throws UploadedObjectMissingError when the object is not present in GCS", async () => {
    const intent = makeIntent();
    intentRepo.seed([intent]);
    storageBindingQueryRepo.seed([makeBinding()]);
    assetStorage.existsResult = false;

    await expect(
      useCase.execute({ publicId: TEST_UUIDS.asset1, uploadedBy: null }),
    ).rejects.toBeInstanceOf(UploadedObjectMissingError);
  });
});
