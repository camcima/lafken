import { NamespacePolicy } from "@/namespaces/domain/entities/namespace-policy.entity";
import { Namespace } from "@/namespaces/domain/entities/namespace.entity";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";
import { UploadIntentWriteRepositoryPort } from "@/assets/domain/repositories/upload-intent-write.repository.port";
import { TusNotConfiguredError } from "@/assets/domain/errors/tus-not-configured.error";
import {
  UploadUrlIssuerPort,
  type IIssueUploadUrlInput,
  type IIssueUploadUrlResult,
  type UploadProtocol,
} from "@/assets/domain/services/upload-url-issuer.service.port";
import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";

import { InMemoryNamespaceQueryRepository } from "../../../namespaces/__fakes__/in-memory-namespace-query.repository";
import { InMemoryStorageBindingQueryRepository } from "../../../system/__fakes__/in-memory-storage-binding-query.repository";
import { FakeUploadIntentWriteRepository } from "../../../../__fakes__/fake-upload-intent-write.repository";

const NS_ID = "01900000-0000-7000-8000-000000000010";
const POLICY_ID = "01900000-0000-7000-8000-000000000020";
const BINDING_ID = "01900000-0000-7000-8000-000000000001";

function makeNamespace(): Namespace {
  return Namespace.fromProps({
    id: NS_ID,
    slug: new Slug("n"),
    displayName: "Test Namespace",
    description: null,
    currentPolicyId: POLICY_ID,
    storageBindingId: BINDING_ID,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makePolicy(): NamespacePolicy {
  return NamespacePolicy.fromProps({
    id: POLICY_ID,
    namespaceId: NS_ID,
    version: 1,
    retentionDays: null,
    retentionMode: "none",
    maxFileSizeBytes: 10_485_760n,
    allowedMimeTypes: ["image/jpeg", "image/png"],
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
    id: BINDING_ID,
    name: "primary-gcs",
    adapterType: "gcs",
    config: { bucket: "test-bucket", projectId: "test-project" },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export function buildNamespaceRepoStub(): NamespaceQueryRepositoryPort {
  const repo = new InMemoryNamespaceQueryRepository();
  const ns = makeNamespace();
  const policy = makePolicy();
  repo.seed([ns]);
  repo.seedPolicies(NS_ID, [policy]);
  return repo;
}

export function buildBindingRepoStub(): StorageBindingQueryRepositoryPort {
  const repo = new InMemoryStorageBindingQueryRepository();
  repo.seed([makeBinding()]);
  return repo;
}

export function buildIntentRepoStub(): UploadIntentWriteRepositoryPort {
  return new FakeUploadIntentWriteRepository();
}

interface IIssuerStubOptions {
  simpleUrl?: string;
  tusUrl?: string;
  throwTusUnconfigured?: boolean;
}

interface IIssuerStubResult extends UploadUrlIssuerPort {
  calls: IIssueUploadUrlInput[];
}

export function buildIssuerStub(opts: IIssuerStubOptions = {}): IIssuerStubResult {
  const calls: IIssueUploadUrlInput[] = [];

  const stub: IIssuerStubResult = Object.assign(
    Object.create(UploadUrlIssuerPort.prototype) as UploadUrlIssuerPort,
    {
      calls,
      issue(input: IIssueUploadUrlInput): Promise<IIssueUploadUrlResult> {
        calls.push(input);
        if (input.protocol === "tus" && opts.throwTusUnconfigured === true) {
          return Promise.reject(new TusNotConfiguredError());
        }
        const protocol: UploadProtocol = input.protocol;
        const uploadUrl =
          protocol === "tus"
            ? (opts.tusUrl ?? "http://tusd:1080/files/stub")
            : (opts.simpleUrl ?? "https://fake-gcs.local/upload/stub");
        const uploadHeaders: Record<string, string> =
          protocol === "tus"
            ? { "Tus-Resumable": "1.0.0" }
            : { "Content-Type": input.contentType };
        return Promise.resolve({
          protocol,
          uploadUrl,
          uploadHeaders,
          expiresAt: new Date(Date.now() + 900_000),
        });
      },
    },
  );

  return stub;
}
