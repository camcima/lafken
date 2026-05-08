import { beforeEach, describe, expect, it } from "vitest";

import { Asset, type IAssetProps } from "@/assets/domain/entities/asset.entity";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetNotInQuarantineError } from "@/assets/domain/errors/asset-not-in-quarantine.error";
import { AssetUnderLegalHoldError } from "@/assets/domain/errors/asset-under-legal-hold.error";
import type { AssetState } from "@/assets/domain/value-objects/asset-state.value-object";
import { RejectQuarantinedAssetUseCase } from "@/quarantine/application/use-cases/reject-quarantined-asset.use-case";

import { FakeAssetWriteRepository } from "../../../__fakes__/fake-asset-write.repository";
import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryAssetQueryRepository } from "../../assets/__fakes__/in-memory-asset-query.repository";

function makeAsset(state: AssetState, legalHold = false): Asset {
  const now = new Date();
  const props: IAssetProps = {
    id: TEST_UUIDS.asset1,
    publicId: TEST_UUIDS.asset1,
    namespaceId: TEST_UUIDS.namespace1,
    policyVersionId: TEST_UUIDS.policy1,
    storageBindingId: TEST_UUIDS.storageBinding1,
    storageKey: `aircraft-photos/assets/${TEST_UUIDS.asset1}/source`,
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
    legalHold,
    legalHoldReference: null,
    confirmedAt: now,
    stateChangedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  return Asset.fromProps(props);
}

describe("RejectQuarantinedAssetUseCase", () => {
  let queryRepo: InMemoryAssetQueryRepository;
  let writeRepo: FakeAssetWriteRepository;
  let useCase: RejectQuarantinedAssetUseCase;

  beforeEach(() => {
    queryRepo = new InMemoryAssetQueryRepository();
    writeRepo = new FakeAssetWriteRepository();
    useCase = new RejectQuarantinedAssetUseCase(queryRepo, writeRepo);
  });

  it("transitions a quarantined asset to rejected and persists the note", async () => {
    queryRepo.seed([makeAsset("quarantined_moderation")]);
    writeRepo.transitionResponses.set(TEST_UUIDS.asset1, makeAsset("rejected"));

    const result = await useCase.execute({
      publicId: TEST_UUIDS.asset1,
      reviewerId: "reviewer@example.com",
      note: "Confirmed graphic-injury detail per policy.",
    });

    expect(result.props.state).toBe("rejected");
    expect(writeRepo.transitions).toHaveLength(1);
    expect(writeRepo.transitions[0]).toMatchObject({
      publicId: TEST_UUIDS.asset1,
      toState: "rejected",
      by: "reviewer@example.com",
    });
    expect(writeRepo.transitions[0]?.metadata).toMatchObject({
      decision: "reject",
      note: "Confirmed graphic-injury detail per policy.",
    });
  });

  it("throws AssetNotFoundError when no asset exists", async () => {
    await expect(
      useCase.execute({ publicId: "missing", reviewerId: null, note: "n/a long enough" }),
    ).rejects.toBeInstanceOf(AssetNotFoundError);
  });

  it("throws AssetNotInQuarantineError when state isn't a quarantine state", async () => {
    queryRepo.seed([makeAsset("ready")]);
    await expect(
      useCase.execute({
        publicId: TEST_UUIDS.asset1,
        reviewerId: null,
        note: "long enough note here",
      }),
    ).rejects.toBeInstanceOf(AssetNotInQuarantineError);
  });

  it("throws AssetUnderLegalHoldError when the asset is on legal hold", async () => {
    queryRepo.seed([makeAsset("quarantined_invalid_format", true)]);
    await expect(
      useCase.execute({
        publicId: TEST_UUIDS.asset1,
        reviewerId: null,
        note: "should not transition",
      }),
    ).rejects.toBeInstanceOf(AssetUnderLegalHoldError);
  });
});
