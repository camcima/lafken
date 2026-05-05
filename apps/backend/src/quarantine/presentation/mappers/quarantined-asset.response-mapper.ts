import type { QuarantinedAssetResponseDTO } from "@shared/backend-api";

import type { QuarantinedAssetView } from "@/quarantine/domain/entities/quarantined-asset-view.entity";

export class QuarantinedAssetResponseMapper {
  static fromDomain(view: QuarantinedAssetView): QuarantinedAssetResponseDTO {
    return {
      publicId: view.props.publicId,
      namespaceSlug: view.props.namespaceSlug,
      policyVersion: view.props.policyVersion,
      state: view.props.state as QuarantinedAssetResponseDTO["state"],
      stateReason: view.props.stateReason ?? undefined,
      sizeBytes:
        view.props.sizeBytes !== null && view.props.sizeBytes !== undefined
          ? Number(view.props.sizeBytes)
          : undefined,
      mimeType: view.props.mimeType ?? undefined,
      declaredMimeType: view.props.declaredMimeType ?? undefined,
      width: view.props.width ?? undefined,
      height: view.props.height ?? undefined,
      contentHashHex: view.props.contentHash?.toString("hex") ?? undefined,
      uploadedBy: view.props.uploadedBy ?? undefined,
      owningRecordType: view.props.owningRecordType ?? undefined,
      owningRecordId: view.props.owningRecordId ?? undefined,
      customMetadata: view.props.customMetadata,
      captureContext: view.props.captureContext ?? undefined,
      legalHold: view.props.legalHold,
      confirmedAt: view.props.confirmedAt?.toISOString() ?? undefined,
      stateChangedAt: view.props.stateChangedAt.toISOString(),
      createdAt: view.props.createdAt.toISOString(),
      // Quarantined assets are not previewable; never expose their bytes
      // through the rendering proxy.
      previewUrls: {},
      quarantineKind: view.props.quarantineKind,
      flaggedAnalyzer: view.props.flaggedAnalyzer ?? undefined,
      flaggedCategory: view.props.flaggedCategory ?? undefined,
      flaggedScore: view.props.flaggedScore ?? undefined,
      flaggedAt: view.props.flaggedAt.toISOString(),
    };
  }
}
