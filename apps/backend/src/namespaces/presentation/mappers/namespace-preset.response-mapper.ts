import { NamespacePresetResponseDTO } from "@shared/backend-api";

import { NamespacePreset } from "@/namespaces/domain/entities/namespace-preset.entity";

export class NamespacePresetResponseMapper {
  static fromDomain(preset: NamespacePreset): NamespacePresetResponseDTO {
    return {
      name: preset.props.name,
      version: preset.props.version,
      transformation: preset.props.transformation,
      cdnMaxAge: preset.props.cdnMaxAge ?? undefined,
      signedUrlTtl: preset.props.signedUrlTtl ?? undefined,
      preGenerate: preset.props.preGenerate,
      requiredPermission: preset.props.requiredPermission ?? undefined,
      description: preset.props.description ?? undefined,
      active: preset.props.active,
      createdAt: preset.props.createdAt.toISOString(),
    };
  }
}
