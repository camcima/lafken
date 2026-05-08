import { beforeEach, describe, expect, it } from "vitest";

import { RetryAssetProcessingUseCase } from "@/assets/application/use-cases/retry-asset-processing.use-case";
import { Asset } from "@/assets/domain/entities/asset.entity";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetNotInProcessingFailedStateError } from "@/assets/domain/errors/asset-not-in-processing-failed-state.error";
import {
  AssetProcessingRepositoryPort,
  type IAssetWithPolicy,
  type IRecordAnalysisInput,
  type IRestartProcessingInput,
  type ITransitionAssetInput,
  type IUpdateDerivedMetadataInput,
} from "@/assets/domain/repositories/asset-processing.repository.port";
import type { AssetState } from "@/assets/domain/value-objects/asset-state.value-object";

import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryAssetQueryRepository } from "../__fakes__/in-memory-asset-query.repository";

const ASSET_ID = "asset-internal-id-1";
const REQUESTER_EMAIL = "ops@latam.com";

function makeAsset(overrides: { state: AssetState }): Asset {
  const now = new Date();
  return Asset.fromProps({
    id: ASSET_ID,
    publicId: TEST_UUIDS.asset1,
    namespaceId: TEST_UUIDS.namespace1,
    policyVersionId: TEST_UUIDS.policy1,
    storageBindingId: TEST_UUIDS.storageBinding1,
    storageKey: `aircraft-photos/assets/${TEST_UUIDS.asset1}/source`,
    state: overrides.state,
    stateReason: null,
    sizeBytes: 1_048_576n,
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
  });
}

class FakeAssetProcessingRepository extends AssetProcessingRepositoryPort {
  readonly restartCalls: IRestartProcessingInput[] = [];
  restartResult: boolean = true;

  findAssetWithPolicy(): Promise<IAssetWithPolicy | null> {
    throw new Error("findAssetWithPolicy is not used by RetryAssetProcessingUseCase tests");
  }

  transitionAsset(input: ITransitionAssetInput): Promise<boolean> {
    void input;
    throw new Error("transitionAsset is not used by RetryAssetProcessingUseCase tests");
  }

  recordAnalysis(input: IRecordAnalysisInput): Promise<void> {
    void input;
    throw new Error("recordAnalysis is not used by RetryAssetProcessingUseCase tests");
  }

  updateDerivedMetadata(input: IUpdateDerivedMetadataInput): Promise<void> {
    void input;
    throw new Error("updateDerivedMetadata is not used by RetryAssetProcessingUseCase tests");
  }

  restartProcessing(input: IRestartProcessingInput): Promise<boolean> {
    this.restartCalls.push(input);
    return Promise.resolve(this.restartResult);
  }
}

describe("RetryAssetProcessingUseCase", () => {
  let queryRepo: InMemoryAssetQueryRepository;
  let processingRepo: FakeAssetProcessingRepository;
  let useCase: RetryAssetProcessingUseCase;

  beforeEach(() => {
    queryRepo = new InMemoryAssetQueryRepository();
    processingRepo = new FakeAssetProcessingRepository();
    useCase = new RetryAssetProcessingUseCase(queryRepo, processingRepo);
  });

  it("re-primes processing for an asset currently in processing_failed", async () => {
    queryRepo.seed([makeAsset({ state: "processing_failed" })]);

    await useCase.execute({
      id: ASSET_ID,
      requestedByEmail: REQUESTER_EMAIL,
    });

    expect(processingRepo.restartCalls).toHaveLength(1);
    const call = processingRepo.restartCalls[0];
    expect(call?.assetId).toBe(ASSET_ID);
    expect(call?.reason).toBe("retry_requested");
    expect(call?.requestedByEmail).toBe(REQUESTER_EMAIL);
    expect(call?.now).toBeInstanceOf(Date);
  });

  it("throws AssetNotFoundError when no asset matches the publicId", async () => {
    await expect(
      useCase.execute({ id: ASSET_ID, requestedByEmail: REQUESTER_EMAIL }),
    ).rejects.toBeInstanceOf(AssetNotFoundError);
    expect(processingRepo.restartCalls).toHaveLength(0);
  });

  it("throws AssetNotInProcessingFailedStateError when the asset is in another state", async () => {
    queryRepo.seed([makeAsset({ state: "ready" })]);

    await expect(
      useCase.execute({ id: ASSET_ID, requestedByEmail: REQUESTER_EMAIL }),
    ).rejects.toBeInstanceOf(AssetNotInProcessingFailedStateError);
    expect(processingRepo.restartCalls).toHaveLength(0);
  });

  it("throws AssetNotInProcessingFailedStateError when the conditional update loses a race", async () => {
    // Read returns processing_failed, but the conditional update returns false:
    // simulates another caller transitioning the row between the two operations.
    queryRepo.seed([makeAsset({ state: "processing_failed" })]);
    processingRepo.restartResult = false;

    await expect(
      useCase.execute({ id: ASSET_ID, requestedByEmail: REQUESTER_EMAIL }),
    ).rejects.toBeInstanceOf(AssetNotInProcessingFailedStateError);
    expect(processingRepo.restartCalls).toHaveLength(1);
  });
});
