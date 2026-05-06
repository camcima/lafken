import { Asset, type IAssetProps } from "@/assets/domain/entities/asset.entity";
import { ProcessingJob } from "@/assets/domain/entities/processing-job.entity";
import {
  type INamespacePolicyProps,
  NamespacePolicy,
} from "@/namespaces/domain/entities/namespace-policy.entity";
import {
  type IStorageBindingProps,
  StorageBinding,
} from "@/system/domain/entities/storage-binding.entity";

export const TEST_UUIDS = {
  asset1: "11111111-1111-1111-1111-111111111111",
  namespace1: "22222222-2222-2222-2222-222222222222",
  policy1: "33333333-3333-3333-3333-333333333333",
  storageBinding1: "44444444-4444-4444-4444-444444444444",
};

export function makeAsset(overrides: Partial<IAssetProps> = {}): Asset {
  return Asset.fromProps({
    id: TEST_UUIDS.asset1,
    publicId: "55555555-5555-5555-5555-555555555555",
    namespaceId: TEST_UUIDS.namespace1,
    policyVersionId: TEST_UUIDS.policy1,
    storageBindingId: TEST_UUIDS.storageBinding1,
    storageKey: "uploads/test.png",
    state: "uploaded",
    stateReason: null,
    sizeBytes: 12n,
    mimeType: null,
    declaredMimeType: "image/png",
    width: null,
    height: null,
    contentHash: null,
    uploadedBy: "worker-test",
    owningRecordType: null,
    owningRecordId: null,
    customMetadata: {},
    captureContext: null,
    legalHold: false,
    confirmedAt: new Date("2026-05-06T11:59:00.000Z"),
    stateChangedAt: new Date("2026-05-06T11:59:00.000Z"),
    createdAt: new Date("2026-05-06T11:59:00.000Z"),
    updatedAt: new Date("2026-05-06T11:59:00.000Z"),
    ...overrides,
  });
}

export function makePolicy(overrides: Partial<INamespacePolicyProps> = {}): NamespacePolicy {
  return NamespacePolicy.fromProps({
    id: TEST_UUIDS.policy1,
    namespaceId: TEST_UUIDS.namespace1,
    version: 1,
    retentionDays: null,
    retentionMode: "none",
    maxFileSizeBytes: 52_428_800n,
    allowedMimeTypes: ["image/png"],
    exifHandling: "extract_then_strip",
    virusScanRequired: true,
    contentModeration: null,
    requiredMetadataSchema: null,
    immutable: false,
    servingMode: "signed",
    signedUrlTtlSeconds: 3600,
    signedUrlBucketSize: 300,
    retryConfig: null,
    createdBy: null,
    createdAt: new Date("2026-05-06T11:59:00.000Z"),
    ...overrides,
  });
}

export function makeStorageBinding(overrides: Partial<IStorageBindingProps> = {}): StorageBinding {
  return StorageBinding.fromProps({
    id: TEST_UUIDS.storageBinding1,
    name: "processing-test-binding",
    adapterType: "gcs",
    config: { bucket: "lafken-test", projectId: "lafken-test" },
    createdAt: new Date("2026-05-06T11:59:00.000Z"),
    updatedAt: new Date("2026-05-06T11:59:00.000Z"),
    ...overrides,
  });
}

export function makeJob(assetId: string = TEST_UUIDS.asset1, attemptNumber = 1): ProcessingJob {
  return ProcessingJob.fromProps({
    assetId,
    state: "claimed",
    workerId: "worker-a",
    currentStep: "claim",
    attemptNumber,
    notBefore: null,
    claimedAt: new Date("2026-05-06T12:00:00.000Z"),
    heartbeatAt: new Date("2026-05-06T12:00:00.000Z"),
    lastError: null,
    lastErrorAt: null,
    createdAt: new Date("2026-05-06T11:59:00.000Z"),
    updatedAt: new Date("2026-05-06T12:00:00.000Z"),
  });
}
