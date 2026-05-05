import { AssetResponseDTO } from "@shared/backend-api";

import type { Asset } from "@/assets/domain/entities/asset.entity";
import type {
  IPreviewSpec,
  PreviewUrlSignerPort,
} from "@/assets/domain/services/preview-url-signer.port";

export interface IPreviewSignContext {
  signer: PreviewUrlSignerPort;
  /** Active namespace presets to expand into preview URLs. */
  presets: Array<{ name: string; spec: IPreviewSpec }>;
  /** Base URL prefix imgproxy will use to fetch the source object. */
  sourceBaseUrl: string;
  /** Bucket the source object lives in. */
  bucket: string;
}

export class AssetResponseMapper {
  static fromDomain(asset: Asset, namespaceSlug: string, policyVersion: number): AssetResponseDTO {
    return {
      publicId: asset.props.publicId,
      namespaceSlug,
      policyVersion,
      state: asset.props.state,
      stateReason: asset.props.stateReason ?? undefined,
      sizeBytes:
        asset.props.sizeBytes !== null && asset.props.sizeBytes !== undefined
          ? Number(asset.props.sizeBytes)
          : undefined,
      mimeType: asset.props.mimeType ?? undefined,
      declaredMimeType: asset.props.declaredMimeType ?? undefined,
      width: asset.props.width ?? undefined,
      height: asset.props.height ?? undefined,
      contentHashHex: asset.props.contentHash?.toString("hex") ?? undefined,
      uploadedBy: asset.props.uploadedBy ?? undefined,
      owningRecordType: asset.props.owningRecordType ?? undefined,
      owningRecordId: asset.props.owningRecordId ?? undefined,
      customMetadata: asset.props.customMetadata,
      captureContext: asset.props.captureContext ?? undefined,
      legalHold: asset.props.legalHold,
      confirmedAt: asset.props.confirmedAt?.toISOString() ?? undefined,
      stateChangedAt: asset.props.stateChangedAt.toISOString(),
      createdAt: asset.props.createdAt.toISOString(),
    };
  }
}
