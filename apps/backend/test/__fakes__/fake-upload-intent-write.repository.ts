import { UploadIntent } from "@/assets/domain/entities/upload-intent.entity";
import {
  IInsertUploadIntentInput,
  UploadIntentWriteRepositoryPort,
} from "@/assets/domain/repositories/upload-intent-write.repository.port";

export class FakeUploadIntentWriteRepository extends UploadIntentWriteRepositoryPort {
  readonly inserted: UploadIntent[] = [];
  private intents: UploadIntent[] = [];
  private nextId = 1;

  seed(intents: UploadIntent[]): void {
    this.intents = [...intents];
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
}
