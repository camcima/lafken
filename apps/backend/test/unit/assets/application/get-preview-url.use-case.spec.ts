import { beforeEach, describe, expect, it } from "vitest";

import { GetPreviewUrlUseCase } from "@/assets/application/use-cases/get-preview-url.use-case";
import { Asset, type IAssetProps } from "@/assets/domain/entities/asset.entity";
import { ActivePresetNotFoundError } from "@/assets/domain/errors/active-preset-not-found.error";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetNotPreviewableError } from "@/assets/domain/errors/asset-not-previewable.error";
import {
  type ISignPreviewInput,
  PreviewUrlSignerPort,
} from "@/assets/domain/services/preview-url-signer.port";
import type { AssetState } from "@/assets/domain/value-objects/asset-state.value-object";
import { NamespacePreset } from "@/namespaces/domain/entities/namespace-preset.entity";
import { PresetParams } from "@/namespaces/domain/value-objects/preset-params.value-object";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";

import { FakeAssetStorage } from "../../../__fakes__/fake-asset-storage";
import { FakeMetricsPort } from "../../../__fakes__/fake-metrics.port";
import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryNamespaceQueryRepository } from "../../namespaces/__fakes__/in-memory-namespace-query.repository";
import { InMemoryStorageBindingQueryRepository } from "../../system/__fakes__/in-memory-storage-binding-query.repository";
import { InMemoryAssetQueryRepository } from "../__fakes__/in-memory-asset-query.repository";

const NAMESPACE_SLUG = "preview-ns";
const STORAGE_KEY = `preview-ns/assets/${TEST_UUIDS.asset1}/source`;

class FakePreviewUrlSigner extends PreviewUrlSignerPort {
  readonly signed: ISignPreviewInput[] = [];
  signResult: string | null = "https://imgproxy.local/signed/abc";

  sign(input: ISignPreviewInput): string | null {
    this.signed.push(input);
    return this.signResult;
  }
}

function makeAsset(state: AssetState = "ready"): Asset {
  const now = new Date();
  const props: IAssetProps = {
    id: TEST_UUIDS.asset1,
    publicId: TEST_UUIDS.asset1,
    namespaceId: TEST_UUIDS.namespace1,
    policyVersionId: TEST_UUIDS.policy1,
    storageBindingId: TEST_UUIDS.storageBinding1,
    storageKey: STORAGE_KEY,
    state,
    stateReason: null,
    sizeBytes: 1024n,
    mimeType: "image/jpeg",
    declaredMimeType: "image/jpeg",
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

function makePreset(name: string, version: number, width: number): NamespacePreset {
  return NamespacePreset.fromProps({
    id: TEST_UUIDS.preset1,
    namespaceId: TEST_UUIDS.namespace1,
    name,
    version,
    params: PresetParams.fromUnknown({
      width,
      height: 400,
      fit: "cover",
      format: "webp",
      quality: 85,
    }),
    cdnMaxAge: null,
    signedUrlTtl: null,
    preGenerate: false,
    requiredPermission: null,
    description: null,
    active: true,
    createdAt: new Date(),
  });
}

describe("GetPreviewUrlUseCase", () => {
  let assetRepo: InMemoryAssetQueryRepository;
  let namespaceRepo: InMemoryNamespaceQueryRepository;
  let bindingRepo: InMemoryStorageBindingQueryRepository;
  let storage: FakeAssetStorage;
  let signer: FakePreviewUrlSigner;
  let metrics: FakeMetricsPort;
  let useCase: GetPreviewUrlUseCase;

  beforeEach(() => {
    assetRepo = new InMemoryAssetQueryRepository();
    namespaceRepo = new InMemoryNamespaceQueryRepository();
    bindingRepo = new InMemoryStorageBindingQueryRepository();
    storage = new FakeAssetStorage();
    signer = new FakePreviewUrlSigner();
    metrics = new FakeMetricsPort();
    useCase = new GetPreviewUrlUseCase(
      assetRepo,
      namespaceRepo,
      bindingRepo,
      storage,
      signer,
      metrics,
    );
    assetRepo.seed([makeAsset()]);
    assetRepo.seedNamespaceSlug(TEST_UUIDS.namespace1, NAMESPACE_SLUG);
    bindingRepo.seed([makeBinding()]);
  });

  it("mints a signed URL for a system preset with a 900s expiry", async () => {
    const before = Date.now();
    const result = await useCase.execute({
      publicId: TEST_UUIDS.asset1,
      presetName: "lafken:thumbnail",
    });

    expect(result.url).toBe("https://imgproxy.local/signed/abc");
    expect(result.namespaceSlug).toBe(NAMESPACE_SLUG);
    expect(result.presetName).toBe("lafken:thumbnail");
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 899_000);
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 900_000);
    // Source URL signed against the asset's binding with the fixed TTL.
    expect(storage.readSigned).toHaveLength(1);
    expect(storage.readSigned[0]).toEqual({
      binding: { bucket: "test-bucket", projectId: "test-project" },
      storageKey: STORAGE_KEY,
      ttlSeconds: 900,
    });
    // Signer received the system preset spec.
    expect(signer.signed[0]?.preset).toMatchObject({ width: 200, height: 200 });
  });

  it("records the issued counter and duration histogram with slug + preset", async () => {
    await useCase.execute({ publicId: TEST_UUIDS.asset1, presetName: "lafken:thumbnail" });

    expect(metrics.recorded).toContainEqual({
      method: "recordPreviewUrlIssued",
      namespaceSlug: NAMESPACE_SLUG,
      presetName: "lafken:thumbnail",
    });
    const duration = metrics.recorded.find(
      (entry) => (entry as { method: string }).method === "recordPreviewUrlDuration",
    ) as { namespaceSlug: string; presetName: string; durationMs: number } | undefined;
    expect(duration).toMatchObject({
      namespaceSlug: NAMESPACE_SLUG,
      presetName: "lafken:thumbnail",
    });
    expect(duration?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("collapses namespace preset versions to the highest active version per name", async () => {
    // listPresets returns rows ordered (name asc, version desc) in production;
    // the in-memory fake preserves seed order, so seed v2 first to mirror it.
    namespaceRepo.seedPresets([makePreset("cover-md", 2, 640), makePreset("cover-md", 1, 100)]);

    await useCase.execute({ publicId: TEST_UUIDS.asset1, presetName: "cover-md" });

    expect(signer.signed[0]?.preset).toMatchObject({ width: 640 });
  });

  it("lets a system preset win over a same-named namespace preset", async () => {
    namespaceRepo.seedPresets([makePreset("lafken:thumbnail", 1, 999)]);

    await useCase.execute({ publicId: TEST_UUIDS.asset1, presetName: "lafken:thumbnail" });

    expect(signer.signed[0]?.preset).toMatchObject({ width: 200, height: 200 });
  });

  it("throws AssetNotFoundError when no asset matches the publicId", async () => {
    await expect(
      useCase.execute({ publicId: "missing", presetName: "lafken:thumbnail" }),
    ).rejects.toBeInstanceOf(AssetNotFoundError);
  });

  it("throws AssetNotPreviewableError for a quarantined asset", async () => {
    assetRepo.seed([makeAsset("quarantined_virus")]);

    await expect(
      useCase.execute({ publicId: TEST_UUIDS.asset1, presetName: "lafken:thumbnail" }),
    ).rejects.toBeInstanceOf(AssetNotPreviewableError);
  });

  it("throws ActivePresetNotFoundError for an unknown preset name", async () => {
    await expect(
      useCase.execute({ publicId: TEST_UUIDS.asset1, presetName: "no-such-preset" }),
    ).rejects.toBeInstanceOf(ActivePresetNotFoundError);
  });

  it("throws ActivePresetNotFoundError when the asset's binding cannot be resolved", async () => {
    bindingRepo.seed([]);

    await expect(
      useCase.execute({ publicId: TEST_UUIDS.asset1, presetName: "lafken:thumbnail" }),
    ).rejects.toBeInstanceOf(ActivePresetNotFoundError);
  });

  it("throws ActivePresetNotFoundError when the signer is not configured (returns null)", async () => {
    signer.signResult = null;

    await expect(
      useCase.execute({ publicId: TEST_UUIDS.asset1, presetName: "lafken:thumbnail" }),
    ).rejects.toBeInstanceOf(ActivePresetNotFoundError);
  });
});
