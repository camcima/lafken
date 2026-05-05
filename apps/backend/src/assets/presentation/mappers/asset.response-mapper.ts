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
  static fromDomain(
    asset: Asset,
    namespaceSlug: string,
    policyVersion: number,
    signCtx: IPreviewSignContext | null = null,
  ): AssetResponseDTO {
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
      previewUrls: AssetResponseMapper.buildPreviewUrls(asset, signCtx),
    };
  }

  private static buildPreviewUrls(
    asset: Asset,
    signCtx: IPreviewSignContext | null,
  ): Record<string, string> {
    const result: Record<string, string> = {};
    if (signCtx === null) {
      return result;
    }
    if (!AssetResponseMapper.isPreviewable(asset)) {
      return result;
    }
    // The source URL embeds the bucket + storage key. Imgproxy fetches it
    // directly from the configured base URL.
    const sourceUrl: string = `${signCtx.sourceBaseUrl}/${signCtx.bucket}/${asset.props.storageKey}`;
    for (const { name, spec } of signCtx.presets) {
      const url: string | null = signCtx.signer.sign({ sourceUrl, preset: spec });
      if (url !== null) {
        result[name] = url;
      }
    }
    return result;
  }

  /**
   * Only assets with a successfully ingested binary can be previewed. Pending
   * uploads have no source object yet; rejected/quarantined ones must not be
   * exposed.
   */
  private static isPreviewable(asset: Asset): boolean {
    const state: string = asset.props.state;
    return state === "uploaded" || state === "processing" || state === "ready";
  }
}
