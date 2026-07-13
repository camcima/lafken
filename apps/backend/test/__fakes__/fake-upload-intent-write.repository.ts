import { UploadIntent } from "@/assets/domain/entities/upload-intent.entity";
import {
  IFindOrphanedForSweepInput,
  IInsertUploadIntentInput,
  IMarkExpiredInput,
  IRefreshUploadUrlInput,
  UploadIntentWriteRepositoryPort,
} from "@/assets/domain/repositories/upload-intent-write.repository.port";

export class FakeUploadIntentWriteRepository extends UploadIntentWriteRepositoryPort {
  readonly inserted: UploadIntent[] = [];
  private intents: UploadIntent[] = [];
  private nextId = 1;

  seed(intents: UploadIntent[]): void {
    this.intents = [...intents];
  }

  expireSeeded(publicId: string, expiredAt: Date): void {
    const idx = this.intents.findIndex((i) => i.props.publicId === publicId);
    if (idx >= 0) {
      this.intents[idx] = UploadIntent.fromProps({ ...this.intents[idx].props, expiredAt });
    }
  }

  insert(input: IInsertUploadIntentInput): Promise<UploadIntent> {
    const intent = UploadIntent.fromProps({
      id: `fake-intent-id-${String(this.nextId++)}`,
      publicId: input.publicId,
      namespaceId: input.namespaceId,
      policyVersionId: input.policyVersionId,
      storageBindingId: input.storageBindingId,
      storageKey: input.storageKey,
      declaredMimeType: input.declaredMimeType,
      declaredSizeBytes: input.declaredSizeBytes,
      uploadUrl: input.uploadUrl,
      uploadUrlExpiresAt: input.uploadUrlExpiresAt,
      createdBy: input.createdBy,
      consumedAt: null,
      expiredAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.inserted.push(intent);
    this.intents.push(intent);
    return Promise.resolve(intent);
  }

  findByPublicId(publicId: string): Promise<UploadIntent | null> {
    return Promise.resolve(this.intents.find((i) => i.props.publicId === publicId) ?? null);
  }

  markConsumed(publicId: string): Promise<void> {
    const intent = this.intents.find((i) => i.props.publicId === publicId);
    if (intent) {
      const idx = this.intents.indexOf(intent);
      this.intents[idx] = UploadIntent.fromProps({
        ...intent.props,
        consumedAt: new Date(),
      });
    }
    return Promise.resolve();
  }

  findOrphanedForSweep(input: IFindOrphanedForSweepInput): Promise<UploadIntent[]> {
    const cutoff = new Date(input.now.getTime() - input.graceMs);
    const results = this.intents
      .filter(
        (i) =>
          i.props.consumedAt === null &&
          i.props.expiredAt === null &&
          i.props.uploadUrlExpiresAt < cutoff,
      )
      .sort((a, b) => a.props.uploadUrlExpiresAt.getTime() - b.props.uploadUrlExpiresAt.getTime())
      .slice(0, input.limit);
    return Promise.resolve(results);
  }

  markExpired(input: IMarkExpiredInput): Promise<boolean> {
    const intent = this.intents.find(
      (i) =>
        i.props.publicId === input.publicId &&
        i.props.consumedAt === null &&
        i.props.expiredAt === null &&
        i.props.uploadUrlExpiresAt < input.expiresBefore,
    );
    if (!intent) return Promise.resolve(false);
    const idx = this.intents.indexOf(intent);
    this.intents[idx] = UploadIntent.fromProps({ ...intent.props, expiredAt: input.now });
    return Promise.resolve(true);
  }

  refreshUploadUrl(input: IRefreshUploadUrlInput): Promise<boolean> {
    const intent = this.intents.find(
      (i) =>
        i.props.publicId === input.publicId &&
        i.props.consumedAt === null &&
        i.props.expiredAt === null,
    );
    if (!intent) return Promise.resolve(false);
    const idx = this.intents.indexOf(intent);
    this.intents[idx] = UploadIntent.fromProps({
      ...intent.props,
      uploadUrl: input.uploadUrl,
      uploadUrlExpiresAt: input.uploadUrlExpiresAt,
    });
    return Promise.resolve(true);
  }
}
