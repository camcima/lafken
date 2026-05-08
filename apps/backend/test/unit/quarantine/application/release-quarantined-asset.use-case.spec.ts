import { beforeEach, describe, expect, it } from "vitest";

import { Asset, type IAssetProps } from "@/assets/domain/entities/asset.entity";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetNotInQuarantineError } from "@/assets/domain/errors/asset-not-in-quarantine.error";
import { AssetUnderLegalHoldError } from "@/assets/domain/errors/asset-under-legal-hold.error";
import type { AssetState } from "@/assets/domain/value-objects/asset-state.value-object";
import { ReleaseQuarantinedAssetUseCase } from "@/quarantine/application/use-cases/release-quarantined-asset.use-case";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";

import { FakeAssetStorage } from "../../../__fakes__/fake-asset-storage";
import { FakeAssetWriteRepository } from "../../../__fakes__/fake-asset-write.repository";
import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryAssetQueryRepository } from "../../assets/__fakes__/in-memory-asset-query.repository";
import { InMemoryStorageBindingQueryRepository } from "../../system/__fakes__/in-memory-storage-binding-query.repository";

const ORIGINAL_KEY = `aircraft-photos/assets/${TEST_UUIDS.asset1}/source`;
const QUARANTINED_KEY = `_quarantined/${ORIGINAL_KEY}`;

function makeAsset(
  state: AssetState,
  options: { legalHold?: boolean; storageKey?: string } = {},
): Asset {
  const now = new Date();
  const props: IAssetProps = {
    id: TEST_UUIDS.asset1,
    publicId: TEST_UUIDS.asset1,
    namespaceId: TEST_UUIDS.namespace1,
    policyVersionId: TEST_UUIDS.policy1,
    storageBindingId: TEST_UUIDS.storageBinding1,
    storageKey: options.storageKey ?? ORIGINAL_KEY,
    state,
    stateReason: null,
    sizeBytes: 1024n,
    mimeType: null,
    declaredMimeType: "image/jpeg",
    width: null,
    height: null,
    contentHash: null,
    phash: null,
    uploadedBy: "uploader@example.com",
    externalRefType: null,
    externalRefId: null,
    customMetadata: {},
    captureContext: null,
    tags: [],
    legalHold: options.legalHold ?? false,
    legalHoldReference: null,
    confirmedAt: now,
    stateChangedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  return Asset.fromProps(props);
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

describe("ReleaseQuarantinedAssetUseCase", () => {
  let queryRepo: InMemoryAssetQueryRepository;
  let writeRepo: FakeAssetWriteRepository;
  let storage: FakeAssetStorage;
  let bindingRepo: InMemoryStorageBindingQueryRepository;
  let useCase: ReleaseQuarantinedAssetUseCase;

  beforeEach(() => {
    queryRepo = new InMemoryAssetQueryRepository();
    writeRepo = new FakeAssetWriteRepository();
    storage = new FakeAssetStorage();
    bindingRepo = new InMemoryStorageBindingQueryRepository();
    bindingRepo.seed([makeBinding()]);
    useCase = new ReleaseQuarantinedAssetUseCase(queryRepo, writeRepo, storage, bindingRepo);
  });

  it("transitions a quarantined asset to ready and returns the updated asset", async () => {
    queryRepo.seed([makeAsset("quarantined_invalid_format", { storageKey: QUARANTINED_KEY })]);
    storage.objects.set(QUARANTINED_KEY, Buffer.from("bytes"));
    const releasedProps: IAssetProps = {
      ...makeAsset("ready", { storageKey: ORIGINAL_KEY }).props,
    };
    writeRepo.transitionResponses.set(TEST_UUIDS.asset1, Asset.fromProps(releasedProps));

    const result = await useCase.execute({
      publicId: TEST_UUIDS.asset1,
      reviewerId: "reviewer@example.com",
      note: "manual override after sniff false-positive",
    });

    expect(result.props.state).toBe("ready");
    expect(writeRepo.transitions).toHaveLength(1);
    expect(writeRepo.transitions[0]).toMatchObject({
      publicId: TEST_UUIDS.asset1,
      toState: "ready",
      by: "reviewer@example.com",
      newStorageKey: ORIGINAL_KEY,
    });
    expect(writeRepo.transitions[0]?.reason).toContain("released_from_quarantine");
    expect(writeRepo.transitions[0]?.reason).toContain("manual override");
    expect(writeRepo.transitions[0]?.metadata).toMatchObject({
      decision: "release",
      note: "manual override after sniff false-positive",
    });
    // Bytes moved back to the original key.
    expect(storage.moveCalls).toHaveLength(1);
    expect(storage.moveCalls[0]).toMatchObject({
      fromKey: QUARANTINED_KEY,
      toKey: ORIGINAL_KEY,
    });
    expect(storage.objects.has(ORIGINAL_KEY)).toBe(true);
    expect(storage.objects.has(QUARANTINED_KEY)).toBe(false);
  });

  it("does not move bytes when an asset's key was never relocated (legacy quarantine row)", async () => {
    // Asset quarantined before the move-on-quarantine wiring landed: its
    // storage_key has no prefix. Release should still succeed without trying
    // to move the (non-existent) quarantined object.
    queryRepo.seed([makeAsset("quarantined_invalid_format", { storageKey: ORIGINAL_KEY })]);
    writeRepo.transitionResponses.set(TEST_UUIDS.asset1, makeAsset("ready"));

    await useCase.execute({
      publicId: TEST_UUIDS.asset1,
      reviewerId: null,
      note: "legacy release",
    });

    expect(storage.moveCalls).toHaveLength(0);
    expect(writeRepo.transitions[0]?.newStorageKey).toBeUndefined();
  });

  it("throws AssetNotFoundError when no asset exists for the publicId", async () => {
    await expect(
      useCase.execute({ publicId: "missing-id", reviewerId: null }),
    ).rejects.toBeInstanceOf(AssetNotFoundError);
  });

  it("throws AssetNotInQuarantineError when asset state is not a quarantine state", async () => {
    queryRepo.seed([makeAsset("uploaded")]);
    await expect(
      useCase.execute({ publicId: TEST_UUIDS.asset1, reviewerId: null }),
    ).rejects.toBeInstanceOf(AssetNotInQuarantineError);
  });

  it("throws AssetUnderLegalHoldError when the asset is on legal hold", async () => {
    queryRepo.seed([makeAsset("quarantined_virus", { legalHold: true })]);
    await expect(
      useCase.execute({ publicId: TEST_UUIDS.asset1, reviewerId: null }),
    ).rejects.toBeInstanceOf(AssetUnderLegalHoldError);
  });
});
