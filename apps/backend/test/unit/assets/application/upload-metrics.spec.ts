import { beforeEach, describe, expect, it } from "vitest";

import { OrphanUploadIntentSweeperUseCase } from "@/assets/application/processing/orphan-upload-intent-sweeper.use-case";
import { ConfirmUploadUseCase } from "@/assets/application/use-cases/confirm-upload.use-case";
import { CreateUploadIntentUseCase } from "@/assets/application/use-cases/create-upload-intent.use-case";
import { RefreshUploadUrlUseCase } from "@/assets/application/use-cases/refresh-upload-url.use-case";
import { UploadIntent } from "@/assets/domain/entities/upload-intent.entity";
import { NamespacePolicy } from "@/namespaces/domain/entities/namespace-policy.entity";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";
import { LAFKEN_METRIC_NAMES } from "@/shared/infrastructure/telemetry/metrics";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";

import { FakeAssetStorage } from "../../../__fakes__/fake-asset-storage";
import { FakeAssetWriteRepository } from "../../../__fakes__/fake-asset-write.repository";
import { FakeUploadIntentWriteRepository } from "../../../__fakes__/fake-upload-intent-write.repository";
import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import {
  findCounterPoint,
  type IMetricReaderHandle,
  installInMemoryMetricReader,
} from "../../../__mocks__/in-memory-metric-reader";
import { InMemoryAuditWriteRepository } from "../../audit/__fakes__/in-memory-audit-write.repository";
import { InMemoryNamespaceQueryRepository } from "../../namespaces/__fakes__/in-memory-namespace-query.repository";
import { InMemoryStorageBindingQueryRepository } from "../../system/__fakes__/in-memory-storage-binding-query.repository";
import { InMemoryAssetQueryRepository } from "../__fakes__/in-memory-asset-query.repository";
import { buildIssuerStub as buildCreateIssuerStub } from "./helpers/create-upload-intent-stubs";
import {
  buildAuditWriteRepoStub,
  buildBindingRepoStub,
  buildIntentRepoStub,
  buildStorageStub,
} from "./helpers/orphan-sweeper-stubs";
import {
  buildAuditWriteRepoStub as buildRefreshAuditStub,
  buildBindingRepoStub as buildRefreshBindingStub,
  buildIntentRepoStub as buildRefreshIntentStub,
  buildIssuerStub as buildRefreshIssuerStub,
} from "./helpers/refresh-upload-url-stubs";

const NAMESPACE_SLUG = "ns-test";

function makeNamespace(): Namespace {
  return Namespace.fromProps({
    id: TEST_UUIDS.namespace1,
    slug: new Slug(NAMESPACE_SLUG),
    displayName: "Test Namespace",
    description: null,
    currentPolicyId: TEST_UUIDS.policy1,
    storageBindingId: TEST_UUIDS.storageBinding1,
    archivedAt: null,
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

describe("upload metrics emissions", () => {
  let handle: IMetricReaderHandle;

  beforeEach(() => {
    handle = installInMemoryMetricReader();
    handle.reset();
  });

  it("emits lafken.upload.intent.created with namespace_slug + protocol on create", async () => {
    const namespaceRepo = new InMemoryNamespaceQueryRepository();
    namespaceRepo.seed([makeNamespace()]);
    namespaceRepo.seedPolicies(TEST_UUIDS.namespace1, [makePolicy()]);
    const bindingRepo = new InMemoryStorageBindingQueryRepository();
    bindingRepo.seed([makeBinding()]);
    const intentRepo = new FakeUploadIntentWriteRepository();
    const useCase = new CreateUploadIntentUseCase(
      namespaceRepo,
      bindingRepo,
      intentRepo,
      buildCreateIssuerStub({ simpleUrl: "https://fake-gcs.local/upload/stub" }),
    );

    await useCase.execute({
      namespaceSlug: NAMESPACE_SLUG,
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: 1_048_576n,
      createdBy: null,
    });

    await handle.forceFlush();

    expect(
      findCounterPoint(handle.exporter, LAFKEN_METRIC_NAMES.UPLOAD_INTENT_CREATED, {
        namespace_slug: NAMESPACE_SLUG,
        protocol: "simple",
      })?.value,
    ).toBe(1);
  });

  it("emits lafken.upload.confirmed with namespace_slug + protocol on confirm", async () => {
    const intentRepo = new FakeUploadIntentWriteRepository();
    const intent = UploadIntent.fromProps({
      id: "intent-id-1",
      publicId: TEST_UUIDS.asset1,
      namespaceId: TEST_UUIDS.namespace1,
      policyVersionId: TEST_UUIDS.policy1,
      storageBindingId: TEST_UUIDS.storageBinding1,
      storageKey: `${NAMESPACE_SLUG}/assets/${TEST_UUIDS.asset1}/source`,
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: 1_048_576n,
      uploadUrl: "https://storage.googleapis.com/bucket/key?X-Goog-Signature=abc",
      uploadUrlExpiresAt: new Date(Date.now() + 900_000),
      createdBy: null,
      consumedAt: null,
      expiredAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    intentRepo.seed([intent]);
    const assetWriteRepo = new FakeAssetWriteRepository();
    const assetStorage = new FakeAssetStorage();
    const namespaceRepo = new InMemoryNamespaceQueryRepository();
    namespaceRepo.seedPolicies(TEST_UUIDS.namespace1, [makePolicy()]);
    const bindingRepo = new InMemoryStorageBindingQueryRepository();
    bindingRepo.seed([makeBinding()]);
    const assetQueryRepo = new InMemoryAssetQueryRepository();
    assetQueryRepo.seedNamespaceSlug(TEST_UUIDS.namespace1, NAMESPACE_SLUG);
    const auditRepo = new InMemoryAuditWriteRepository();

    const useCase = new ConfirmUploadUseCase(
      intentRepo,
      assetWriteRepo,
      assetStorage,
      namespaceRepo,
      bindingRepo,
      assetQueryRepo,
      auditRepo,
    );

    await useCase.execute({
      publicId: TEST_UUIDS.asset1,
      uploadedBy: "user@example.com",
      requestIp: null,
    });

    await handle.forceFlush();

    expect(
      findCounterPoint(handle.exporter, LAFKEN_METRIC_NAMES.UPLOAD_CONFIRMED, {
        namespace_slug: NAMESPACE_SLUG,
        protocol: "simple",
      })?.value,
    ).toBe(1);
  });

  it("emits lafken.upload.intent.refreshed with namespace_slug + protocol on refresh", async () => {
    const intentRepo = buildRefreshIntentStub({ protocol: "simple" });
    const issuer = buildRefreshIssuerStub({ simpleUrl: "https://gcs/new" });
    const audit = buildRefreshAuditStub();
    const assetQueryRepo = new InMemoryAssetQueryRepository();
    assetQueryRepo.seedNamespaceSlug("ns-id-1", NAMESPACE_SLUG);
    const useCase = new RefreshUploadUrlUseCase(
      intentRepo,
      buildRefreshBindingStub(),
      issuer,
      audit,
      assetQueryRepo,
    );

    await useCase.execute({ publicId: "pid-1", requestedBy: "ops@latam.com" });

    await handle.forceFlush();

    expect(
      findCounterPoint(handle.exporter, LAFKEN_METRIC_NAMES.UPLOAD_INTENT_REFRESHED, {
        namespace_slug: NAMESPACE_SLUG,
        protocol: "simple",
      })?.value,
    ).toBe(1);
  });

  it("emits lafken.upload.intent.expired_swept with namespace_slug per swept intent", async () => {
    const intents = buildIntentRepoStub({
      orphans: [
        { publicId: "p1", storageBindingId: "b1", storageKey: "k1" },
        { publicId: "p2", storageBindingId: "b1", storageKey: "k2" },
      ],
    });
    const storage = buildStorageStub();
    const audit = buildAuditWriteRepoStub();
    const assetQueryRepo = new InMemoryAssetQueryRepository();
    // The orphan-sweeper stubs build intents with namespaceId = "ns-id-1".
    assetQueryRepo.seedNamespaceSlug("ns-id-1", NAMESPACE_SLUG);

    const useCase = new OrphanUploadIntentSweeperUseCase(
      intents,
      buildBindingRepoStub(),
      storage,
      audit,
      assetQueryRepo,
    );

    await useCase.execute({ now: new Date(), graceMs: 300_000, batchSize: 50 });

    await handle.forceFlush();

    expect(
      findCounterPoint(handle.exporter, LAFKEN_METRIC_NAMES.UPLOAD_INTENT_EXPIRED_SWEPT, {
        namespace_slug: NAMESPACE_SLUG,
      })?.value,
    ).toBe(2);
  });
});
