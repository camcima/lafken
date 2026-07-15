import { Asset } from "@/assets/domain/entities/asset.entity";
import { UploadIntentConsumeConflictError } from "@/assets/domain/errors/upload-intent-consume-conflict.error";
import {
  AssetWriteRepositoryPort,
  ICreateUploadedAssetInput,
  ITransitionStateInput,
} from "@/assets/domain/repositories/asset-write.repository.port";

export class FakeAssetWriteRepository extends AssetWriteRepositoryPort {
  readonly createdAssets: ICreateUploadedAssetInput[] = [];
  readonly transitions: ITransitionStateInput[] = [];
  /** Tests can seed this map to control what `transitionState` returns. */
  readonly transitionResponses = new Map<string, Asset | null>();
  /** When true, `createUploadedAsset` simulates a lost consume race (F-P8). */
  consumeConflict = false;
  private nextId = 1;

  createUploadedAsset(input: ICreateUploadedAssetInput): Promise<Asset> {
    if (this.consumeConflict) {
      return Promise.reject(new UploadIntentConsumeConflictError({ publicId: input.publicId }));
    }
    this.createdAssets.push(input);
    const now = new Date();
    const asset = Asset.fromProps({
      id: `fake-asset-id-${String(this.nextId++)}`,
      publicId: input.publicId,
      namespaceId: input.namespaceId,
      policyVersionId: input.policyVersionId,
      storageBindingId: input.storageBindingId,
      storageKey: input.storageKey,
      state: input.initialState ?? "uploaded",
      stateReason: input.initialStateReason ?? null,
      sizeBytes: input.declaredSizeBytes,
      mimeType: null,
      declaredMimeType: input.declaredMimeType,
      width: input.width ?? null,
      height: input.height ?? null,
      contentHash: null,
      phash: null,
      uploadedBy: input.uploadedBy,
      externalRefType: input.externalRefType ?? null,
      externalRefId: input.externalRefId ?? null,
      customMetadata: input.customMetadata ?? {},
      captureContext: null,
      tags: input.tags ?? [],
      legalHold: false,
      legalHoldReference: null,
      confirmedAt: now,
      stateChangedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return Promise.resolve(asset);
  }

  transitionState(input: ITransitionStateInput): Promise<Asset | null> {
    this.transitions.push(input);
    return Promise.resolve(this.transitionResponses.get(input.publicId) ?? null);
  }
}
