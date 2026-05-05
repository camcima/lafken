import { beforeEach, describe, expect, it } from "vitest";

import { CreateUploadIntentUseCase } from "@/assets/application/use-cases/create-upload-intent.use-case";
import { FileSizeExceedsPolicyError } from "@/assets/domain/errors/file-size-exceeds-policy.error";
import { MimeTypeNotAllowedError } from "@/assets/domain/errors/mime-type-not-allowed.error";
import { NamespacePolicy } from "@/namespaces/domain/entities/namespace-policy.entity";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { NamespaceArchivedError } from "@/namespaces/domain/errors/namespace-archived.error";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";

import { FakeAssetStorage } from "../../../__fakes__/fake-asset-storage";
import { FakeUploadIntentWriteRepository } from "../../../__fakes__/fake-upload-intent-write.repository";
import { TEST_UUIDS } from "../../../__fixtures__/test-uuids";
import { InMemoryNamespaceQueryRepository } from "../../namespaces/__fakes__/in-memory-namespace-query.repository";
import { InMemoryStorageBindingQueryRepository } from "../../system/__fakes__/in-memory-storage-binding-query.repository";

function makeNamespace(opts: { slug: string; archived?: boolean }): Namespace {
  return Namespace.fromProps({
    id: TEST_UUIDS.namespace1,
    slug: new Slug(opts.slug),
    displayName: "Test Namespace",
    description: null,
    currentPolicyId: TEST_UUIDS.policy1,
    storageBindingId: TEST_UUIDS.storageBinding1,
    archivedAt: opts.archived === true ? new Date() : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makePolicy(
  overrides: Partial<{ allowedMimeTypes: string[]; maxFileSizeBytes: bigint }> = {},
): NamespacePolicy {
  return NamespacePolicy.fromProps({
    id: TEST_UUIDS.policy1,
    namespaceId: TEST_UUIDS.namespace1,
    version: 1,
    retentionDays: null,
    retentionMode: "none",
    maxFileSizeBytes: overrides.maxFileSizeBytes ?? 10_485_760n,
    allowedMimeTypes: overrides.allowedMimeTypes ?? ["image/jpeg", "image/png"],
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

describe("CreateUploadIntentUseCase", () => {
  let namespaceQueryRepo: InMemoryNamespaceQueryRepository;
  let storageBindingQueryRepo: InMemoryStorageBindingQueryRepository;
  let intentWriteRepo: FakeUploadIntentWriteRepository;
  let assetStorage: FakeAssetStorage;
  let useCase: CreateUploadIntentUseCase;

  beforeEach(() => {
    namespaceQueryRepo = new InMemoryNamespaceQueryRepository();
    storageBindingQueryRepo = new InMemoryStorageBindingQueryRepository();
    intentWriteRepo = new FakeUploadIntentWriteRepository();
    assetStorage = new FakeAssetStorage();
    useCase = new CreateUploadIntentUseCase(
      namespaceQueryRepo,
      storageBindingQueryRepo,
      intentWriteRepo,
      assetStorage,
    );
  });

  it("returns a signed upload URL and persists the intent for a valid request", async () => {
    const ns = makeNamespace({ slug: "aircraft-photos" });
    const policy = makePolicy();
    const binding = makeBinding();
    namespaceQueryRepo.seed([ns]);
    namespaceQueryRepo.seedPolicies(TEST_UUIDS.namespace1, [policy]);
    storageBindingQueryRepo.seed([binding]);

    const result = await useCase.execute({
      namespaceSlug: "aircraft-photos",
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: 1_048_576n,
      createdBy: "user@example.com",
    });

    expect(result.publicId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(result.uploadUrl).toContain("fake-gcs.local");
    expect(result.uploadHeaders["Content-Type"]).toBe("image/jpeg");
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(intentWriteRepo.inserted).toHaveLength(1);
    expect(intentWriteRepo.inserted[0]?.props.declaredMimeType).toBe("image/jpeg");
    expect(intentWriteRepo.inserted[0]?.props.namespaceId).toBe(TEST_UUIDS.namespace1);
    expect(assetStorage.issued).toHaveLength(1);
    const issuedCall = assetStorage.issued[0];
    expect(issuedCall?.storageKey).toBe(`aircraft-photos/assets/${result.publicId}/source`);
  });

  it("throws NamespaceNotFoundError when the slug does not match any namespace", async () => {
    await expect(
      useCase.execute({
        namespaceSlug: "nonexistent",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: 1_048_576n,
        createdBy: null,
      }),
    ).rejects.toBeInstanceOf(NamespaceNotFoundError);
  });

  it("throws NamespaceArchivedError when the namespace is archived", async () => {
    const ns = makeNamespace({ slug: "aircraft-photos", archived: true });
    namespaceQueryRepo.seed([ns]);

    await expect(
      useCase.execute({
        namespaceSlug: "aircraft-photos",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: 1_048_576n,
        createdBy: null,
      }),
    ).rejects.toBeInstanceOf(NamespaceArchivedError);
  });

  it("throws MimeTypeNotAllowedError when the MIME type is not in the policy allowlist", async () => {
    const ns = makeNamespace({ slug: "aircraft-photos" });
    const policy = makePolicy({ allowedMimeTypes: ["image/jpeg"] });
    const binding = makeBinding();
    namespaceQueryRepo.seed([ns]);
    namespaceQueryRepo.seedPolicies(TEST_UUIDS.namespace1, [policy]);
    storageBindingQueryRepo.seed([binding]);

    await expect(
      useCase.execute({
        namespaceSlug: "aircraft-photos",
        declaredMimeType: "application/pdf",
        declaredSizeBytes: 1_048_576n,
        createdBy: null,
      }),
    ).rejects.toBeInstanceOf(MimeTypeNotAllowedError);
  });

  it("throws FileSizeExceedsPolicyError when the declared size exceeds the policy maximum", async () => {
    const ns = makeNamespace({ slug: "aircraft-photos" });
    const policy = makePolicy({ maxFileSizeBytes: 1_048_576n });
    const binding = makeBinding();
    namespaceQueryRepo.seed([ns]);
    namespaceQueryRepo.seedPolicies(TEST_UUIDS.namespace1, [policy]);
    storageBindingQueryRepo.seed([binding]);

    await expect(
      useCase.execute({
        namespaceSlug: "aircraft-photos",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: 2_097_152n,
        createdBy: null,
      }),
    ).rejects.toBeInstanceOf(FileSizeExceedsPolicyError);
  });
});
