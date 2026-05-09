import { UploadIntent } from "@/assets/domain/entities/upload-intent.entity";
import {
  IRefreshUploadUrlInput,
  UploadIntentWriteRepositoryPort,
} from "@/assets/domain/repositories/upload-intent-write.repository.port";
import {
  IIssueUploadUrlInput,
  IIssueUploadUrlResult,
  UploadProtocol,
  UploadUrlIssuerPort,
} from "@/assets/domain/services/upload-url-issuer.service.port";
import { AuditWriteRepositoryPort, IRecordAuditInput } from "@/audit/domain/repositories/audit-write.repository.port";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

const BINDING_ID = "01900000-0000-7000-8000-000000000001";

// ─────────────────────────────────────────────
// Intent repo stub
// ─────────────────────────────────────────────

interface IIntentStubOptions {
  /** When true, findByPublicId returns null. */
  missing?: true;
  /** Protocol signals simple vs tus via the URL heuristic. */
  protocol?: "simple" | "tus";
  consumedAt?: Date | null;
  expiredAt?: Date | null;
}

interface IIntentRepoStub extends UploadIntentWriteRepositoryPort {
  refreshUploadUrlCalls: IRefreshUploadUrlInput[];
}

export function buildIntentRepoStub(opts: IIntentStubOptions = {}): IIntentRepoStub {
  const refreshUploadUrlCalls: IRefreshUploadUrlInput[] = [];

  // Build the upload URL based on the protocol:
  // simple → contains "X-Goog-Signature", tus → does not.
  const uploadUrl =
    opts.protocol === "tus"
      ? "http://tusd:1080/files/stub-key"
      : "https://storage.googleapis.com/bucket/key?X-Goog-Signature=abc";

  const intent: UploadIntent | null =
    opts.missing === true
      ? null
      : UploadIntent.fromProps({
          id: "intent-id-1",
          publicId: "pid-1",
          namespaceId: "ns-id-1",
          policyVersionId: "policy-id-1",
          storageBindingId: BINDING_ID,
          storageKey: "namespace/assets/pid-1/source",
          declaredMimeType: "image/jpeg",
          declaredSizeBytes: 1_048_576n,
          uploadUrl,
          uploadUrlExpiresAt: new Date(Date.now() + 900_000),
          createdBy: "ops@latam.com",
          consumedAt: opts.consumedAt ?? null,
          expiredAt: opts.expiredAt ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

  const stub: IIntentRepoStub = Object.assign(
    Object.create(UploadIntentWriteRepositoryPort.prototype) as UploadIntentWriteRepositoryPort,
    {
      refreshUploadUrlCalls,

      findByPublicId(_publicId: string): Promise<UploadIntent | null> {
        return Promise.resolve(intent);
      },

      refreshUploadUrl(input: IRefreshUploadUrlInput): Promise<boolean> {
        refreshUploadUrlCalls.push(input);
        // Return false only if already consumed/expired (mirrors the real repo).
        if (intent && (intent.props.consumedAt !== null || intent.props.expiredAt !== null)) {
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      },

      insert(): Promise<UploadIntent> {
        throw new Error("not implemented in stub");
      },

      markConsumed(): Promise<void> {
        return Promise.resolve();
      },

      findOrphanedForSweep(): Promise<UploadIntent[]> {
        return Promise.resolve([]);
      },

      markExpired(): Promise<boolean> {
        return Promise.resolve(false);
      },
    },
  );

  return stub;
}

// ─────────────────────────────────────────────
// Binding repo stub
// ─────────────────────────────────────────────

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
// Issuer stub
// ─────────────────────────────────────────────

interface IIssuerStubOptions {
  simpleUrl?: string;
  tusUrl?: string;
}

export function buildIssuerStub(opts: IIssuerStubOptions = {}): UploadUrlIssuerPort {
  const stub: UploadUrlIssuerPort = Object.assign(
    Object.create(UploadUrlIssuerPort.prototype) as UploadUrlIssuerPort,
    {
      issue(input: IIssueUploadUrlInput): Promise<IIssueUploadUrlResult> {
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
