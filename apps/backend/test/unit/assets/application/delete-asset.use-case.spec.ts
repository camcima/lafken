import { beforeEach, describe, expect, it } from "vitest";

import { DeleteAssetUseCase } from "@/assets/application/use-cases/delete-asset.use-case";
import { Asset } from "@/assets/domain/entities/asset.entity";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetUnderLegalHoldError } from "@/assets/domain/errors/asset-under-legal-hold.error";
import {
  AssetProcessingRepositoryPort,
  type IAssetWithPolicy,
  type IRecordAnalysisInput,
  type IRestartProcessingInput,
  type ITransitionAssetInput,
  type IUpdateDerivedMetadataInput,
} from "@/assets/domain/repositories/asset-processing.repository.port";
import {
  type ICancelJobForAssetInput,
  ProcessingJobRepositoryPort,
} from "@/assets/domain/repositories/processing-job.repository.port";
import type { AssetState } from "@/assets/domain/value-objects/asset-state.value-object";

import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryAssetQueryRepository } from "../__fakes__/in-memory-asset-query.repository";

const ASSET_ID = "asset-internal-id-1";
const REQUESTER_EMAIL = "ops@latam.com";

function makeAsset(overrides: { state: AssetState; legalHold?: boolean }): Asset {
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
    tags: [],
    captureContext: null,
    legalHold: overrides.legalHold ?? false,
    legalHoldReference: null,
    confirmedAt: now,
    stateChangedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

class FakeAssetProcessingRepository extends AssetProcessingRepositoryPort {
  readonly transitionCalls: ITransitionAssetInput[] = [];
  transitionResult: boolean = true;
  onTransitionAttempt: (() => void) | null = null;

  findAssetWithPolicy(): Promise<IAssetWithPolicy | null> {
    throw new Error("findAssetWithPolicy is not used by DeleteAssetUseCase tests");
  }

  transitionAsset(input: ITransitionAssetInput): Promise<boolean> {
    this.transitionCalls.push(input);
    this.onTransitionAttempt?.();
    return Promise.resolve(this.transitionResult);
  }

  recordAnalysis(input: IRecordAnalysisInput): Promise<void> {
    void input;
    throw new Error("recordAnalysis is not used by DeleteAssetUseCase tests");
  }

  updateDerivedMetadata(input: IUpdateDerivedMetadataInput): Promise<void> {
    void input;
    throw new Error("updateDerivedMetadata is not used by DeleteAssetUseCase tests");
  }

  restartProcessing(input: IRestartProcessingInput): Promise<boolean> {
    void input;
    throw new Error("restartProcessing is not used by DeleteAssetUseCase tests");
  }
}

class FakeProcessingJobRepositoryForDelete extends ProcessingJobRepositoryPort {
  readonly cancelCalls: ICancelJobForAssetInput[] = [];

  cancelForAsset(input: ICancelJobForAssetInput): Promise<boolean> {
    this.cancelCalls.push(input);
    return Promise.resolve(true);
  }

  claimAvailable(): never {
    throw new Error("claimAvailable is not used by DeleteAssetUseCase tests");
  }
  heartbeat(): never {
    throw new Error("heartbeat is not used by DeleteAssetUseCase tests");
  }
  updateCurrentStep(): never {
    throw new Error("updateCurrentStep is not used by DeleteAssetUseCase tests");
  }
  releaseForRetry(): never {
    throw new Error("releaseForRetry is not used by DeleteAssetUseCase tests");
  }
  markCompleted(): never {
    throw new Error("markCompleted is not used by DeleteAssetUseCase tests");
  }
  markFailed(): never {
    throw new Error("markFailed is not used by DeleteAssetUseCase tests");
  }
  findStaleClaims(): never {
    throw new Error("findStaleClaims is not used by DeleteAssetUseCase tests");
  }
  releaseStaleClaim(): never {
    throw new Error("releaseStaleClaim is not used by DeleteAssetUseCase tests");
  }
  countDueJobs(): never {
    throw new Error("countDueJobs is not used by DeleteAssetUseCase tests");
  }
}

describe("DeleteAssetUseCase", () => {
  let queryRepo: InMemoryAssetQueryRepository;
  let processingRepo: FakeAssetProcessingRepository;
  let jobRepo: FakeProcessingJobRepositoryForDelete;
  let useCase: DeleteAssetUseCase;

  beforeEach(() => {
    queryRepo = new InMemoryAssetQueryRepository();
    processingRepo = new FakeAssetProcessingRepository();
    jobRepo = new FakeProcessingJobRepositoryForDelete();
    useCase = new DeleteAssetUseCase(queryRepo, processingRepo, jobRepo);
  });

  it("transitions an uploaded asset to deleted with the requester recorded", async () => {
    queryRepo.seed([makeAsset({ state: "uploaded" })]);

    await useCase.execute({
      id: ASSET_ID,
      requestedByEmail: REQUESTER_EMAIL,
    });

    expect(processingRepo.transitionCalls).toHaveLength(1);
    const call = processingRepo.transitionCalls[0];
    expect(call?.assetId).toBe(ASSET_ID);
    expect(call?.fromState).toBe("uploaded");
    expect(call?.toState).toBe("deleted");
    expect(call?.reason).toBe("asset_deleted");
    expect(call?.occurredBy).toBe(REQUESTER_EMAIL);
    expect(call?.metadata).toEqual({ requested_by: REQUESTER_EMAIL });
  });

  it("throws AssetNotFoundError when no asset matches the publicId", async () => {
    await expect(
      useCase.execute({ id: ASSET_ID, requestedByEmail: REQUESTER_EMAIL }),
    ).rejects.toBeInstanceOf(AssetNotFoundError);
    expect(processingRepo.transitionCalls).toHaveLength(0);
  });

  it("throws AssetUnderLegalHoldError when the asset is under legal hold", async () => {
    queryRepo.seed([makeAsset({ state: "ready", legalHold: true })]);

    await expect(
      useCase.execute({ id: ASSET_ID, requestedByEmail: REQUESTER_EMAIL }),
    ).rejects.toBeInstanceOf(AssetUnderLegalHoldError);
    expect(processingRepo.transitionCalls).toHaveLength(0);
  });

  it("returns silently when the asset is already deleted (idempotent)", async () => {
    queryRepo.seed([makeAsset({ state: "deleted" })]);

    await useCase.execute({
      id: ASSET_ID,
      requestedByEmail: REQUESTER_EMAIL,
    });

    expect(processingRepo.transitionCalls).toHaveLength(0);
  });

  it("returns silently when the conditional transition loses a race to a concurrent delete", async () => {
    // Read returns ready; transition returns false (another caller flipped
    // the state); the simulated concurrent caller has already swapped the
    // queryRepo's view to `deleted`, so the re-read is satisfying.
    queryRepo.seed([makeAsset({ state: "ready" })]);
    processingRepo.transitionResult = false;
    processingRepo.onTransitionAttempt = () => {
      queryRepo.seed([makeAsset({ state: "deleted" })]);
    };

    await useCase.execute({
      id: ASSET_ID,
      requestedByEmail: REQUESTER_EMAIL,
    });

    expect(processingRepo.transitionCalls).toHaveLength(1);
  });

  it("returns silently when the conditional transition loses a race and the asset is gone", async () => {
    // Asset disappeared between read and re-read (e.g. hard-purged by a
    // separate process). User intent ("delete") is satisfied either way.
    queryRepo.seed([makeAsset({ state: "ready" })]);
    processingRepo.transitionResult = false;
    processingRepo.onTransitionAttempt = () => {
      queryRepo.seed([]);
    };

    await useCase.execute({
      id: ASSET_ID,
      requestedByEmail: REQUESTER_EMAIL,
    });
  });

  it("throws AssetNotFoundError when the conditional transition loses a race and the asset is in another state", async () => {
    // Race partner concurrently transitioned the asset to something other
    // than 'deleted' (e.g. expired). The user's delete intent is no longer
    // applicable to the now-different state — surface the not-found behavior.
    queryRepo.seed([makeAsset({ state: "ready" })]);
    processingRepo.transitionResult = false;
    processingRepo.onTransitionAttempt = () => {
      queryRepo.seed([makeAsset({ state: "expired" })]);
    };

    await expect(
      useCase.execute({ id: ASSET_ID, requestedByEmail: REQUESTER_EMAIL }),
    ).rejects.toBeInstanceOf(AssetNotFoundError);
  });

  it("cancels the pending processing job after deleting the asset", async () => {
    queryRepo.seed([makeAsset({ state: "uploaded" })]);

    await useCase.execute({ id: ASSET_ID, requestedByEmail: REQUESTER_EMAIL });

    expect(jobRepo.cancelCalls).toEqual([
      expect.objectContaining({ assetId: ASSET_ID, reason: "asset_deleted" }),
    ]);
  });

  it("cancels any leftover job when the asset is already deleted", async () => {
    queryRepo.seed([makeAsset({ state: "deleted" })]);

    await useCase.execute({ id: ASSET_ID, requestedByEmail: REQUESTER_EMAIL });

    expect(jobRepo.cancelCalls).toHaveLength(1);
  });
});
