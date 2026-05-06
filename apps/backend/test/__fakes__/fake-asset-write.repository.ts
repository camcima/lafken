import { Asset } from "@/assets/domain/entities/asset.entity";
import {
  AssetWriteRepositoryPort,
  ICreateUploadedAssetInput,
} from "@/assets/domain/repositories/asset-write.repository.port";

export class FakeAssetWriteRepository extends AssetWriteRepositoryPort {
  readonly createdAssets: ICreateUploadedAssetInput[] = [];
  private nextId = 1;

  createUploadedAsset(input: ICreateUploadedAssetInput): Promise<Asset> {
    this.createdAssets.push(input);
    const now = new Date();
    const asset = Asset.fromProps({
      id: `fake-asset-id-${String(this.nextId++)}`,
      publicId: input.publicId,
      namespaceId: input.namespaceId,
      policyVersionId: input.policyVersionId,
      storageBindingId: input.storageBindingId,
      storageKey: input.storageKey,
      state: "uploaded",
      stateReason: null,
      sizeBytes: input.declaredSizeBytes,
      mimeType: null,
      declaredMimeType: input.declaredMimeType,
      width: input.width ?? null,
      height: input.height ?? null,
      contentHash: null,
      uploadedBy: input.uploadedBy,
      externalRefType: null,
      externalRefId: null,
      customMetadata: {},
      captureContext: null,
      legalHold: false,
      confirmedAt: now,
      stateChangedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return Promise.resolve(asset);
  }
}
