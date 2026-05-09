import { UploadIntent } from "@/assets/domain/entities/upload-intent.entity";
import {
  IFindOrphanedForSweepInput,
  UploadIntentWriteRepositoryPort,
} from "@/assets/domain/repositories/upload-intent-write.repository.port";
import {
  AssetStoragePort,
  type IDeleteObjectInput,
  type IIssueSignedUploadUrlInput,
  type IIssueSignedUploadUrlResult,
  type IMoveObjectInput,
  type IObjectExistsInput,
  type IReadObjectBytesInput,
  type ISignReadUrlInput,
} from "@/assets/domain/services/asset-storage.service.port";
import { AuditWriteRepositoryPort, IRecordAuditInput } from "@/audit/domain/repositories/audit-write.repository.port";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

// ─────────────────────────────────────────────
// Intent repo stub
// ─────────────────────────────────────────────

interface IOrphanDescriptor {
  publicId: string;
  storageBindingId: string;
  storageKey: string;
}

interface IIntentRepoStubOptions {
  orphans?: IOrphanDescriptor[];
  /** When false, markExpired always returns false (lost race). Defaults to true. */
  markExpiredReturns?: boolean;
}

interface IIntentRepoStub extends UploadIntentWriteRepositoryPort {
  markExpiredCalls: Array<{ publicId: string }>;
}

function makeOrphanIntent(desc: IOrphanDescriptor): UploadIntent {
  return UploadIntent.fromProps({
    id: `intent-id-${desc.publicId}`,
    publicId: desc.publicId,
    namespaceId: "ns-id-1",
    policyVersionId: "policy-id-1",
    storageBindingId: desc.storageBindingId,
    storageKey: desc.storageKey,
    declaredMimeType: "image/jpeg",
    declaredSizeBytes: 1_048_576n,
    uploadUrl: "https://fake-gcs.local/upload/stub",
    uploadUrlExpiresAt: new Date(Date.now() - 1_000_000),
    createdBy: "ops@latam.com",
    consumedAt: null,
    expiredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export function buildIntentRepoStub(opts: IIntentRepoStubOptions = {}): IIntentRepoStub {
  const markExpiredCalls: Array<{ publicId: string }> = [];
  const orphanIntents: UploadIntent[] = (opts.orphans ?? []).map(makeOrphanIntent);
  const markExpiredReturns: boolean = opts.markExpiredReturns ?? true;

  const stub: IIntentRepoStub = Object.assign(
    Object.create(UploadIntentWriteRepositoryPort.prototype) as UploadIntentWriteRepositoryPort,
    {
      markExpiredCalls,

      findOrphanedForSweep(_input: IFindOrphanedForSweepInput): Promise<UploadIntent[]> {
        return Promise.resolve(orphanIntents);
      },

      markExpired(publicId: string, _now: Date): Promise<boolean> {
        markExpiredCalls.push({ publicId });
        return Promise.resolve(markExpiredReturns);
      },

      insert(): Promise<UploadIntent> {
        throw new Error("not implemented in orphan-sweeper stub");
      },

      findByPublicId(): Promise<UploadIntent | null> {
        return Promise.resolve(null);
      },

      markConsumed(): Promise<void> {
        return Promise.resolve();
      },

      refreshUploadUrl(): Promise<boolean> {
        return Promise.resolve(false);
      },
    },
  );

  return stub;
}

// ─────────────────────────────────────────────
// Binding repo stub
// ─────────────────────────────────────────────

const BINDING_ID = "01900000-0000-7000-8000-000000000001";

export function buildBindingRepoStub(): StorageBindingQueryRepositoryPort {
  const binding = StorageBinding.fromProps({
    id: BINDING_ID,
    name: "primary-gcs",
    adapterType: "gcs",
    config: { bucket: "test-bucket", projectId: "test-project" },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const stub: StorageBindingQueryRepositoryPort = Object.assign(
    Object.create(StorageBindingQueryRepositoryPort.prototype) as StorageBindingQueryRepositoryPort,
    {
      findById(_id: string): Promise<StorageBinding | null> {
        return Promise.resolve(binding);
      },

      list(): Promise<StorageBinding[]> {
        return Promise.resolve([binding]);
      },

      findByName(_name: string): Promise<StorageBinding | null> {
        return Promise.resolve(binding);
      },
    },
  );

  return stub;
}

// ─────────────────────────────────────────────
// Storage stub
// ─────────────────────────────────────────────

interface IStorageStubOptions {
  throwOnDelete?: Error;
}

interface IStorageStub extends AssetStoragePort {
  deleteCalls: Array<{ storageKey: string }>;
}

export function buildStorageStub(opts: IStorageStubOptions = {}): IStorageStub {
  const deleteCalls: Array<{ storageKey: string }> = [];

  const stub: IStorageStub = Object.assign(
    Object.create(AssetStoragePort.prototype) as AssetStoragePort,
    {
      deleteCalls,

      deleteObject(input: IDeleteObjectInput): Promise<void> {
        deleteCalls.push({ storageKey: input.storageKey });
        if (opts.throwOnDelete) {
          return Promise.reject(opts.throwOnDelete);
        }
        return Promise.resolve();
      },

      issueSignedUploadUrl(_input: IIssueSignedUploadUrlInput): Promise<IIssueSignedUploadUrlResult> {
        throw new Error("not implemented in storage stub");
      },

      objectExists(_input: IObjectExistsInput): Promise<boolean> {
        return Promise.resolve(false);
      },

      readObjectBytes(_input: IReadObjectBytesInput): Promise<Buffer> {
        throw new Error("not implemented in storage stub");
      },

      signReadUrl(_input: ISignReadUrlInput): Promise<string> {
        throw new Error("not implemented in storage stub");
      },

      signSourceUrlForRendering(_input: ISignReadUrlInput): Promise<string> {
        throw new Error("not implemented in storage stub");
      },

      moveObject(_input: IMoveObjectInput): Promise<void> {
        throw new Error("not implemented in storage stub");
      },
    },
  );

  return stub;
}

// ─────────────────────────────────────────────
// Audit write repo stub
// ─────────────────────────────────────────────

interface IAuditWriteRepoStub extends AuditWriteRepositoryPort {
  calls: IRecordAuditInput[];
}

export function buildAuditWriteRepoStub(): IAuditWriteRepoStub {
  const calls: IRecordAuditInput[] = [];

  const stub: IAuditWriteRepoStub = Object.assign(
    Object.create(AuditWriteRepositoryPort.prototype) as AuditWriteRepositoryPort,
    {
      calls,
      record(input: IRecordAuditInput): Promise<void> {
        calls.push(input);
        return Promise.resolve();
      },
    },
  );

  return stub;
}
