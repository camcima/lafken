import { Asset } from "@/assets/domain/entities/asset.entity";
import {
  AssetWriteRepositoryPort,
  ICreateUploadedAssetInput,
} from "@/assets/domain/repositories/asset-write.repository.port";

let idCounter = 1;

export class FakeAssetWriteRepository extends AssetWriteRepositoryPort {
  readonly createdAssets: ICreateUploadedAssetInput[] = [];

  createUploadedAsset(input: ICreateUploadedAssetInput): Promise<Asset> {
    this.createdAssets.push(input);
    const now = new Date();
    const asset = Asset.fromProps({
      id: `fake-asset-id-${String(idCounter++)}`,
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
      width: null,
      height: null,
      contentHash: null,
      uploadedBy: input.uploadedBy,
      owningRecordType: null,
      owningRecordId: null,
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
